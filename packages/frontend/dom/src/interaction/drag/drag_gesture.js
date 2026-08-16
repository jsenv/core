/**
 * Drag Gesture System
 *
 * TODO: rename moveX/moveY en juste x/y
 * puisque move c'est perturbant sachant que c'est drag + scroll
 * et que drag c'est juste la partie mouvement de la souris
 *
 * donc juste x/y ca seras surement mieux
 *
 */

import { dispatchPublicCustomEvent } from "../../dom_events.js";
import { createPubSub } from "../../pub_sub.js";
import { findFocusable } from "../focus/find_focusable.js";
import { isolateInteractions } from "../isolate_interactions.js";

const css = /* css */ `
  .navi_drag_gesture_backdrop {
    position: fixed;
    inset: 0;
    /* A finger dragging must not also pan the page under it. The backdrop is
       the only element the finger can be over once the gesture is running. */
    touch-action: none;
    user-select: none;
  }
  /* Chrome matches :focus-visible on a programmatic focus, so focusing what the
     gesture holds draws a ring around an object the user already has under the
     pointer — a frame blinking for the length of the gesture, saying something
     the finger knows. The ring stays whole where it earns its place: at the
     keyboard, outside any gesture.
     focus({ focusVisible: false }) would say the intent better but does not
     hold — Chrome's heuristic does not always obey the option (see
     isMatchingFocusVisible). */
  [data-drag-focus]:focus-visible {
    outline: none;
  }
`;
import.meta.css = css;

export const createDragGestureController = (options = {}) => {
  const {
    name,
    onGrab,
    onDragStart,
    onDrag,
    onRelease,
    threshold = 5,
    direction: defaultDirection = { x: true, y: true },
    documentInteractions = "auto",
    backdrop = true,
    backdropZIndex = 999999,
  } = options;

  const dragGestureController = {
    grab: null,
    gravViaPointer: null,
  };

  const grab = ({
    element,
    direction = defaultDirection,
    event = new CustomEvent("programmatic"),
    grabX = 0,
    grabY = 0,
    cursor = "grabbing",
    scrollContainer = document.documentElement,
    layoutScrollableLeft: scrollableLeftAtGrab = 0,
    layoutScrollableTop: scrollableTopAtGrab = 0,
  } = {}) => {
    if (!element) {
      throw new Error("element is required");
    }
    if (!direction.x && !direction.y) {
      return null;
    }

    const [publishBeforeDrag, addBeforeDragCallback] = createPubSub();
    const [publishDrag, addDragCallback] = createPubSub();
    const [publishRelease, addReleaseCallback] = createPubSub();
    if (onDrag) {
      addDragCallback(onDrag);
    }
    if (onRelease) {
      addReleaseCallback(onRelease);
    }

    const scrollLeftAtGrab = scrollContainer.scrollLeft;
    const scrollTopAtGrab = scrollContainer.scrollTop;
    const leftAtGrab = scrollLeftAtGrab + scrollableLeftAtGrab;
    const topAtGrab = scrollTopAtGrab + scrollableTopAtGrab;
    const createLayout = (x, y) => {
      const { scrollLeft, scrollTop } = scrollContainer;
      const left = scrollableLeftAtGrab + x;
      const top = scrollableTopAtGrab + y;
      const scrollableLeft = left - scrollLeft;
      const scrollableTop = top - scrollTop;
      const layoutProps = {
        // Raw input coordinates (dragX - grabX + scrollContainer.scrollLeft)
        x,
        y,
        // container scrolls when layout is created
        scrollLeft,
        scrollTop,
        // Position relative to container excluding scrolls
        scrollableLeft,
        scrollableTop,
        // Position relative to container including scrolls
        left,
        top,
        // Delta since grab (number representing how much we dragged)
        xDelta: left - leftAtGrab,
        yDelta: top - topAtGrab,
      };
      return layoutProps;
    };

    const grabLayout = createLayout(
      grabX + scrollContainer.scrollLeft,
      grabY + scrollContainer.scrollTop,
    );
    const gestureInfo = {
      name,
      direction,
      started: !threshold,
      status: "grabbed",

      element,
      scrollContainer,
      grabX, // x grab coordinate (excluding scroll)
      grabY, // y grab coordinate (excluding scroll)
      grabLayout,
      leftAtGrab,
      topAtGrab,

      dragX: grabX, // coordinate of the last drag (excluding scroll of the scrollContainer)
      dragY: grabY, // coordinate of the last drag (excluding scroll of the scrollContainer)
      layout: grabLayout,

      isGoingUp: undefined,
      isGoingDown: undefined,
      isGoingLeft: undefined,
      isGoingRight: undefined,
      intentGoingUp: false,
      intentGoingDown: false,
      intentGoingLeft: false,
      intentGoingRight: false,

      // How fast the pointer is going, in px/ms, signed per axis
      // (see measureVelocity)
      velocityX: 0,
      velocityY: 0,
      velocity: 0,

      // metadata about interaction sources
      grabEvent: event,
      dragEvent: null,
      releaseEvent: null,
    };
    definePropertyAsReadOnly(gestureInfo, "name");
    definePropertyAsReadOnly(gestureInfo, "direction");
    definePropertyAsReadOnly(gestureInfo, "scrollContainer");
    definePropertyAsReadOnly(gestureInfo, "grabX");
    definePropertyAsReadOnly(gestureInfo, "grabY");
    definePropertyAsReadOnly(gestureInfo, "grabLayout");
    definePropertyAsReadOnly(gestureInfo, "leftAtGrab");
    definePropertyAsReadOnly(gestureInfo, "topAtGrab");
    definePropertyAsReadOnly(gestureInfo, "grabEvent");

    // Where the pointer IS is not where it is going: throwing something is a
    // matter of speed, and the gesture is the only place that sees the timing of
    // the events it receives.
    const measureVelocity = createVelocityMeter(grabX, grabY);

    document_interactions: {
      if (documentInteractions === "manual") {
        break document_interactions;
      }
      /*
      GOAL: Take control of document-level interactions during drag gestures
      
      WHY: During drag operations, we need to prevent conflicting user interactions that would:
      1. Interfere with the drag gesture (competing pointer events, focus changes)
      2. Break the visual feedback (inconsistent cursors, hover states)
      3. Cause unwanted scrolling (keyboard shortcuts, wheel events in restricted directions)
      4. Create accessibility issues (focus jumping, screen reader confusion)

      STRATEGY: Create a controlled interaction environment by:
      1. VISUAL CONTROL: Use a backdrop to unify cursor appearance and block pointer events
      2. INTERACTION ISOLATION: Make non-dragged elements inert to prevent interference
      3. FOCUS MANAGEMENT: Control focus location and prevent focus changes during drag
      4. SELECTIVE SCROLLING: Allow scrolling only in directions supported by the drag gesture

      IMPLEMENTATION:
      */

      // 1. INTERACTION ISOLATION: Make everything except the dragged element inert
      // This prevents keyboard events, pointer interactions, and screen reader navigation
      // on non-relevant elements during the drag operation
      const cleanupInert = isolateInteractions([
        element,
        ...Array.from(document.querySelectorAll("[data-droppable]")),
      ]);
      addReleaseCallback(() => {
        cleanupInert();
      });

      // 2. VISUAL CONTROL: Backdrop for consistent cursor and pointer event blocking
      if (backdrop) {
        const backdropElement = document.createElement("div");
        backdropElement.className = "navi_drag_gesture_backdrop";
        backdropElement.ariaHidden = "true";
        backdropElement.setAttribute("data-backdrop", "");
        backdropElement.style.zIndex = backdropZIndex;
        backdropElement.style.cursor = cursor;

        // Handle wheel events on backdrop for directionally-constrained drag gestures
        // (e.g., table column resize should only allow horizontal scrolling)
        if (!direction.x || !direction.y) {
          backdropElement.onwheel = (e) => {
            e.preventDefault();
            const scrollX = direction.x ? e.deltaX : 0;
            const scrollY = direction.y ? e.deltaY : 0;
            scrollContainer.scrollBy({
              left: scrollX,
              top: scrollY,
              behavior: "auto",
            });
          };
        }
        document.body.appendChild(backdropElement);
        addReleaseCallback(() => {
          backdropElement.remove();
        });
      }

      // 3. FOCUS MANAGEMENT: Control and stabilize focus during drag
      const { activeElement } = document;
      const focusableElement = findFocusable(element);
      // Focus the dragged element (or document.body as fallback) to establish clear focus context
      // This also ensure any keydown event listened by the currently focused element
      // won't be available during drag
      const elementToFocus = focusableElement || document.body;
      elementToFocus.setAttribute("data-drag-focus", "");
      elementToFocus.focus({
        preventScroll: true,
      });
      addReleaseCallback(() => {
        elementToFocus.removeAttribute("data-drag-focus");
        // Restore original focus on release
        activeElement.focus({
          preventScroll: true,
        });
      });
      // Prevent Tab navigation entirely (focus should stay stable)
      const onkeydown = (e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          return;
        }
      };
      document.addEventListener("keydown", onkeydown);
      addReleaseCallback(() => {
        document.removeEventListener("keydown", onkeydown);
      });

      // 4. SELECTIVE SCROLLING: Allow keyboard scrolling only in supported directions
      scroll_via_keyboard: {
        const onDocumentKeydown = (keyboardEvent) => {
          // Vertical scrolling keys - prevent if vertical movement not supported
          if (
            keyboardEvent.key === "ArrowUp" ||
            keyboardEvent.key === "ArrowDown" ||
            keyboardEvent.key === " " ||
            keyboardEvent.key === "PageUp" ||
            keyboardEvent.key === "PageDown" ||
            keyboardEvent.key === "Home" ||
            keyboardEvent.key === "End"
          ) {
            if (!direction.y) {
              keyboardEvent.preventDefault();
            }
            return;
          }
          // Horizontal scrolling keys - prevent if horizontal movement not supported
          if (
            keyboardEvent.key === "ArrowLeft" ||
            keyboardEvent.key === "ArrowRight"
          ) {
            if (!direction.x) {
              keyboardEvent.preventDefault();
            }
            return;
          }
        };
        document.addEventListener("keydown", onDocumentKeydown);
        addReleaseCallback(() => {
          document.removeEventListener("keydown", onDocumentKeydown);
        });
      }
    }

    // Set up scroll event handling to adjust drag position when scrolling occurs
    drag_on_scroll: {
      let isHandlingScroll = false;
      const handleScroll = (scrollEvent) => {
        if (isHandlingScroll) {
          return;
        }
        isHandlingScroll = true;
        drag(gestureInfo.dragX, gestureInfo.dragY, { event: scrollEvent });
        isHandlingScroll = false;
      };
      const scrollEventReceiver =
        scrollContainer === document.documentElement
          ? document
          : scrollContainer;
      scrollEventReceiver.addEventListener("scroll", handleScroll, {
        passive: true,
      });
      addReleaseCallback(() => {
        scrollEventReceiver.removeEventListener("scroll", handleScroll, {
          passive: true,
        });
      });
    }

    const determineDragData = ({
      dragX,
      dragY,
      dragEvent,
      isRelease = false,
    }) => {
      // === ÉTAT INITIAL (au moment du grab) ===
      const { grabX, grabY, grabLayout } = gestureInfo;
      // === CE QUI EST DEMANDÉ (où on veut aller) ===
      // Calcul de la direction basé sur le mouvement précédent
      // (ne tient pas compte du mouvement final une fois les contraintes appliquées)
      // (ici on veut connaitre l'intention)
      // on va utiliser cela pour savoir vers où on scroll si nécéssaire par ex
      const currentDragX = gestureInfo.dragX;
      const currentDragY = gestureInfo.dragY;
      const isGoingLeft = dragX < currentDragX;
      const isGoingRight = dragX > currentDragX;
      const isGoingUp = dragY < currentDragY;
      const isGoingDown = dragY > currentDragY;

      const layoutXRequested = direction.x
        ? scrollContainer.scrollLeft + (dragX - grabX)
        : grabLayout.scrollLeft;
      const layoutYRequested = direction.y
        ? scrollContainer.scrollTop + (dragY - grabY)
        : grabLayout.scrollTop;
      const layoutRequested = createLayout(layoutXRequested, layoutYRequested);
      const currentLayout = gestureInfo.layout;
      let layout;
      if (
        layoutRequested.x === currentLayout.x &&
        layoutRequested.y === currentLayout.y
      ) {
        layout = currentLayout;
      } else {
        // === APPLICATION DES CONTRAINTES ===
        let layoutConstrained = layoutRequested;
        const limitLayout = (left, top) => {
          layoutConstrained = createLayout(
            left === undefined
              ? layoutConstrained.x
              : left - scrollableLeftAtGrab,
            top === undefined ? layoutConstrained.y : top - scrollableTopAtGrab,
          );
        };

        publishBeforeDrag(layoutRequested, currentLayout, limitLayout, {
          dragEvent,
          isRelease,
        });
        // === ÉTAT FINAL ===
        layout = layoutConstrained;
      }

      const dragData = {
        dragX,
        dragY,
        layout,

        isGoingLeft,
        isGoingRight,
        isGoingUp,
        isGoingDown,

        status: isRelease ? "released" : "dragging",
        dragEvent: isRelease ? gestureInfo.dragEvent : dragEvent,
        releaseEvent: isRelease ? dragEvent : null,
      };

      if (isRelease) {
        return dragData;
      }
      if (!gestureInfo.started && threshold) {
        const deltaX = Math.abs(dragX - grabX);
        const deltaY = Math.abs(dragY - grabY);
        if (direction.x && direction.y) {
          // Both directions: check both axes
          if (deltaX < threshold && deltaY < threshold) {
            return dragData;
          }
        } else if (direction.x) {
          if (deltaX < threshold) {
            return dragData;
          }
        } else if (direction.y) {
          if (deltaY < threshold) {
            return dragData;
          }
        }
        dragData.started = true;
      }
      return dragData;
    };

    const markAsStarted = () => {
      // Suppress the click that the browser fires after pointerup following a real drag.
      // The capture phase runs before any element onClick handler.
      const suppressClick = (clickEvent) => {
        clickEvent.stopPropagation();
        clickEvent.preventDefault();
        stopSuppressingClick();
      };
      // That click is dispatched AFTER the pointerup that ends the drag, so
      // this cannot be taken down with the gesture — it would be gone one event
      // too early, and the drag would end on the link it started from being
      // followed. It goes once it has swallowed the click, or at the next press
      // if the drag produced none: a click is always preceded by a press, so a
      // suppressor that outlives one press can never reach the click of
      // another.
      const stopSuppressingClick = () => {
        document.removeEventListener("click", suppressClick, {
          capture: true,
        });
        document.removeEventListener("pointerdown", stopSuppressingClick, {
          capture: true,
        });
      };
      document.addEventListener("click", suppressClick, { capture: true });
      addReleaseCallback(() => {
        document.addEventListener("pointerdown", stopSuppressingClick, {
          capture: true,
        });
      });
      // Everything this gesture puts on the document is in place, and undoable,
      // BEFORE anybody is told it started: a listener may end the gesture from
      // inside this very notification — that is how a press becomes a drag (see
      // dragAfterIntent, where the gesture that measured the distance releases
      // itself the moment it is confirmed). Set up afterwards, a listener would
      // be registering its own removal with a gesture that is already over, and
      // would then outlive it: what one sees is a click swallowed long after
      // the drag it belonged to.
      dispatchPublicCustomEvent(element, "navi_drag_start", {
        gestureInfo,
      });
      onDragStart?.(gestureInfo);
    };

    // Declares the gesture confirmed without waiting for the distance threshold,
    // for callers who established the intent some other way (a dedicated handle,
    // a long press).
    const start = () => {
      if (gestureInfo.started) {
        return;
      }
      gestureInfo.started = true;
      markAsStarted();
    };

    const drag = (
      dragX = gestureInfo.dragX, // Scroll container relative X coordinate
      dragY = gestureInfo.dragY, // Scroll container relative Y coordinate
      { event = new CustomEvent("programmatic"), isRelease = false } = {},
    ) => {
      if (import.meta.dev && (isNaN(dragX) || isNaN(dragY))) {
        throw new Error(`Invalid drag coordinates x=${dragX} y=${dragY}`);
      }

      const dragData = determineDragData({
        dragX,
        dragY,
        dragEvent: event,
        isRelease,
      });
      const [velocityX, velocityY] = measureVelocity(dragX, dragY);
      const startedPrevious = gestureInfo.started;
      const layoutPrevious = gestureInfo.layout;
      // previousGestureInfo = { ...gestureInfo };
      Object.assign(gestureInfo, dragData);
      gestureInfo.velocityX = velocityX;
      gestureInfo.velocityY = velocityY;
      gestureInfo.velocity = Math.hypot(velocityX, velocityY);
      if (gestureInfo.isGoingDown) {
        gestureInfo.intentGoingDown = true;
        gestureInfo.intentGoingUp = false;
      } else if (gestureInfo.isGoingUp) {
        gestureInfo.intentGoingUp = true;
        gestureInfo.intentGoingDown = false;
      }
      if (gestureInfo.isGoingRight) {
        gestureInfo.intentGoingRight = true;
        gestureInfo.intentGoingLeft = false;
      } else if (gestureInfo.isGoingLeft) {
        gestureInfo.intentGoingLeft = true;
        gestureInfo.intentGoingRight = false;
      }
      if (!startedPrevious && gestureInfo.started) {
        markAsStarted();
      }
      const someLayoutChange = gestureInfo.layout !== layoutPrevious;
      dispatchPublicCustomEvent(element, "navi_drag", {
        gestureInfo,
        someLayoutChange,
      });
      publishDrag(
        gestureInfo,
        // we still publish drag event even when unchanged
        // because UI might need to adjust when document scrolls
        // even if nothing truly changes visually the element
        // can decide to stick to the scroll for example
        someLayoutChange,
      );
    };

    const release = ({
      event = new CustomEvent("programmatic"),
      releaseX = gestureInfo.dragX,
      releaseY = gestureInfo.dragY,
    } = {}) => {
      drag(releaseX, releaseY, { event, isRelease: true });
      dispatchPublicCustomEvent(element, "navi_drag_release", { gestureInfo });
      publishRelease(gestureInfo);
    };

    dispatchPublicCustomEvent(element, "navi_drag_grab", { gestureInfo });
    onGrab?.(gestureInfo);
    const dragGesture = {
      gestureInfo,
      addBeforeDragCallback,
      addDragCallback,
      addReleaseCallback,
      start,
      drag,
      release,
    };
    return dragGesture;
  };
  dragGestureController.grab = grab;

  const initDragByPointer = (grabEvent, dragOptions, initializer) => {
    if (!isPrimaryButtonEvent(grabEvent)) {
      return null;
    }
    const target = grabEvent.target;
    if (!target.closest) {
      // target is a text node
      return null;
    }
    const mouseEventCoords = (mouseEvent) => {
      const { clientX, clientY } = mouseEvent;
      return [clientX, clientY];
    };
    const [grabX, grabY] = mouseEventCoords(grabEvent);
    const dragGesture = dragGestureController.grab({
      grabX,
      grabY,
      event: grabEvent,
      ...dragOptions,
    });
    const dragViaPointer = (dragEvent) => {
      const [mouseDragX, mouseDragY] = mouseEventCoords(dragEvent);
      dragGesture.drag(mouseDragX, mouseDragY, {
        event: dragEvent,
      });
    };
    const releaseViaPointer = (mouseupEvent) => {
      const [mouseReleaseX, mouseReleaseY] = mouseEventCoords(mouseupEvent);
      dragGesture.release({
        event: mouseupEvent,
        releaseX: mouseReleaseX,
        releaseY: mouseReleaseY,
      });
    };
    dragGesture.dragViaPointer = dragViaPointer;
    dragGesture.releaseViaPointer = releaseViaPointer;
    const cleanup = initializer({
      onMove: dragViaPointer,
      onRelease: releaseViaPointer,
      gestureInfo: dragGesture.gestureInfo,
    });
    dragGesture.addReleaseCallback(() => {
      cleanup();
    });
    return dragGesture;
  };

  const grabViaPointer = (grabEvent, options) => {
    if (grabEvent.type === "pointerdown") {
      return initDragByPointer(
        grabEvent,
        options,
        ({ onMove, onRelease, gestureInfo }) => {
          // Captured on something that will still be there at the end of the
          // gesture: the browser releases the capture when its element leaves the
          // document, and a gesture whose own effect replaces the DOM under the
          // finger would lose the pointer at its first move. Callers whose target
          // is stable have nothing to say and keep it.
          const target = options?.pointerCaptureElement || grabEvent.target;
          target.setPointerCapture(grabEvent.pointerId);
          /*
           * A touchmove left alone is the browser deciding the touch belongs to
           * it: it takes it to scroll with, and a touch it has taken is a pointer
           * stream it CANCELS — the gesture dies mid-move, the finger is still
           * down, and nothing reads it anymore.
           *
           * Refused only once the gesture is established (a `touch-action: none`
           * would take the touch from everyone who merely brushes past the
           * element), but LISTENED FOR from the grab: whether a touchmove can be
           * refused at all is decided when the touch begins, from the listeners
           * present at that moment. Registered later, the listener is handed
           * events that are already `cancelable: false` — refusing them does
           * nothing, and the reason is invisible in the code that refuses.
           *
           * On the window in capture AND on the grabbed element: a touch keeps
           * being dispatched at the node it started on, and a gesture may take
           * that node out of the document (a page that travels navigates) — from
           * then on the event never passes through the window on its way
           * anywhere.
           */
          const preventTouchScroll = (touchMoveEvent) => {
            if (gestureInfo.started && touchMoveEvent.cancelable) {
              touchMoveEvent.preventDefault();
            }
          };
          const grabTarget = grabEvent.target;
          window.addEventListener("touchmove", preventTouchScroll, {
            passive: false,
            capture: true,
          });
          grabTarget.addEventListener("touchmove", preventTouchScroll, {
            passive: false,
          });
          // Only OUR capture ending means this gesture is over:
          // lostpointercapture bubbles, so a descendant giving up its own capture
          // walks straight into this listener. That is not a rare shape — it is
          // exactly what happens when a gesture hands over to another one (a
          // press that becomes a drag releases its intermediate gesture, held on
          // the pressed element, while the real one is being held on a container
          // above it), and taken as our own it kills the new gesture one
          // millisecond after it started.
          const onCaptureLost = (pointerEvent) => {
            if (pointerEvent.target !== target) {
              return;
            }
            onRelease(pointerEvent);
          };
          target.addEventListener("lostpointercapture", onCaptureLost);
          target.addEventListener("pointercancel", onRelease);
          target.addEventListener("pointermove", onMove);
          target.addEventListener("pointerup", onRelease);
          // The end of the pointer is also listened for on the window, because
          // the end is the one event a gesture cannot afford to miss and the
          // element it is captured on is not always on its way: a pointer can
          // be delivered somewhere else entirely (a browser view transition
          // sends presses to the document root), and a cancel dispatched there
          // never passes through this element. Missed, the gesture never ends —
          // whatever it was holding stays held.
          let released = false;
          const onPointerEnd = (pointerEvent) => {
            if (pointerEvent.pointerId !== grabEvent.pointerId || released) {
              return;
            }
            released = true;
            onRelease(pointerEvent);
          };
          window.addEventListener("pointerup", onPointerEnd, true);
          window.addEventListener("pointercancel", onPointerEnd, true);
          return () => {
            // Listeners first, capture last: giving the pointer back is the
            // one thing here that can throw, and a gesture that fails to clean
            // up half way is worse than one that never cleaned up at all — its
            // listeners stay on the element and answer the NEXT gesture, from
            // a gesture whose pointer is long gone.
            window.removeEventListener("touchmove", preventTouchScroll, {
              capture: true,
            });
            grabTarget.removeEventListener("touchmove", preventTouchScroll);
            target.removeEventListener("lostpointercapture", onCaptureLost);
            target.removeEventListener("pointercancel", onRelease);
            target.removeEventListener("pointermove", onMove);
            target.removeEventListener("pointerup", onRelease);
            window.removeEventListener("pointerup", onPointerEnd, true);
            window.removeEventListener("pointercancel", onPointerEnd, true);
            // Asked for only while there is something to give back: a pointer
            // that is up no longer exists, the browser has already dropped the
            // capture with it, and asking again throws ("No active pointer with
            // the given id is found") — on the most ordinary release there is.
            if (target.hasPointerCapture(grabEvent.pointerId)) {
              target.releasePointerCapture(grabEvent.pointerId);
            }
          };
        },
      );
    }
    if (grabEvent.type === "mousedown") {
      console.warn(
        `Received "mousedown" event, "pointerdown" events are recommended to perform drag gestures.`,
      );
      return initDragByPointer(grabEvent, options, ({ onMove, onRelease }) => {
        const onPointerUp = (pointerEvent) => {
          // <button disabled> for example does not emit mouseup if we release mouse over it
          // -> we add "pointerup" to catch mouseup occuring on disabled element
          if (pointerEvent.pointerType === "mouse") {
            onRelease(pointerEvent);
          }
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onRelease);
        document.addEventListener("pointerup", onPointerUp);
        return () => {
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onRelease);
          document.removeEventListener("pointerup", onPointerUp);
        };
      });
    }
    throw new Error(
      `Unsupported "${grabEvent.type}" evenet passed to grabViaPointer. "pointerdown" was expected.`,
    );
  };
  dragGestureController.grabViaPointer = grabViaPointer;

  return dragGestureController;
};

// Only the primary button drags: a right click (or any secondary button) opens
// a context menu, it never grabs anything.
export const isPrimaryButtonEvent = (event) =>
  event.button === undefined || event.button === 0;

/*
 * Speed over the last VELOCITY_WINDOW_MS rather than between the last two
 * events: pointer events arrive irregularly, and the last one before a release
 * often repeats the previous coordinates — measured on that pair alone, every
 * throw would end at zero.
 * A pointer held still keeps producing samples at the same place, so the window
 * empties itself of movement and the speed falls back to zero on its own: put
 * down slowly is not thrown.
 */
const VELOCITY_WINDOW_MS = 100;
const createVelocityMeter = (grabX, grabY) => {
  const samples = [{ time: performance.now(), x: grabX, y: grabY }];

  const measureVelocity = (x, y) => {
    const time = performance.now();
    samples.push({ time, x, y });
    while (samples.length > 2 && time - samples[1].time > VELOCITY_WINDOW_MS) {
      samples.shift();
    }
    const oldestSample = samples[0];
    const elapsed = time - oldestSample.time;
    if (elapsed === 0) {
      return [0, 0];
    }
    return [(x - oldestSample.x) / elapsed, (y - oldestSample.y) / elapsed];
  };

  return measureVelocity;
};

const definePropertyAsReadOnly = (object, propertyName) => {
  Object.defineProperty(object, propertyName, {
    writable: false,
    value: object[propertyName],
  });
};
