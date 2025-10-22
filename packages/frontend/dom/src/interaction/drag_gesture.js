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

import { findFocusable } from "../focus/find_focusable.js";
import { createPubSub } from "../pub_sub.js";
import { makeRestInert } from "./inert.js";

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
      const cleanupInert = makeRestInert(element, "[data-droppable]");
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
      // Focus the dragged element (or document.body as fallback) to establish clear focus context
      const elementToFocus = focusableElement || document.body;
      elementToFocus.focus({
        preventScroll: true,
      });
      addReleaseCallback(() => {
        // Restore original focus on release
        activeElement.focus({
          preventScroll: true,
        });
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
      const startedPrevious = gestureInfo.started;
      const layoutPrevious = gestureInfo.layout;
      // previousGestureInfo = { ...gestureInfo };
      Object.assign(gestureInfo, dragData);
      if (!startedPrevious && gestureInfo.started) {
        onDragStart?.(gestureInfo);
      }
      const someLayoutChange = gestureInfo.layout !== layoutPrevious;
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
      publishRelease(gestureInfo);
    };

    onGrab?.(gestureInfo);
    const dragGesture = {
      gestureInfo,
      addBeforeDragCallback,
      addDragCallback,
      addReleaseCallback,
      drag,
      release,
    };
    return dragGesture;
  };
  dragGestureController.grab = grab;

  const initDragByPointer = (grabEvent, dragOptions, initializer) => {
    if (grabEvent.button !== undefined && grabEvent.button !== 0) {
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
    });
    dragGesture.addReleaseCallback(() => {
      cleanup();
    });
    return dragGesture;
  };

  const grabViaPointer = (grabEvent, options) => {
    if (grabEvent.type === "pointerdown") {
      return initDragByPointer(grabEvent, options, ({ onMove, onRelease }) => {
        const target = grabEvent.target;
        target.setPointerCapture(grabEvent.pointerId);
        target.addEventListener("lostpointercapture", onRelease);
        target.addEventListener("pointercancel", onRelease);
        target.addEventListener("pointermove", onMove);
        target.addEventListener("pointerup", onRelease);
        return () => {
          target.releasePointerCapture(grabEvent.pointerId);
          target.removeEventListener("lostpointercapture", onRelease);
          target.removeEventListener("pointercancel", onRelease);
          target.removeEventListener("pointermove", onMove);
          target.removeEventListener("pointerup", onRelease);
        };
      });
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

export const dragAfterThreshold = (
  grabEvent,
  dragGestureInitializer,
  threshold,
) => {
  const significantDragGestureController = createDragGestureController({
    threshold,
    // allow interaction for this intermediate gesture:
    // user should still be able to scroll or interact with the document
    // only once the gesture is significant we take control
    documentInteractions: "manual",
    onDragStart: (gestureInfo) => {
      significantDragGesture.release(); // kill that gesture
      const dragGesture = dragGestureInitializer();
      dragGesture.dragViaPointer(gestureInfo.dragEvent);
    },
  });
  const significantDragGesture =
    significantDragGestureController.grabViaPointer(grabEvent, {
      element: grabEvent.target,
    });
};

const definePropertyAsReadOnly = (object, propertyName) => {
  Object.defineProperty(object, propertyName, {
    writable: false,
    value: object[propertyName],
  });
};

import.meta.css = /* css */ `
  .navi_drag_gesture_backdrop {
    position: fixed;
    inset: 0;
    user-select: none;
  }
`;
