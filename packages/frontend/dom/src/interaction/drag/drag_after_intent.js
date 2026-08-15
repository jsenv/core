/**
 * When a press becomes a drag.
 *
 * A pointer going down on a draggable element is ambiguous — it may be a click,
 * a text selection, a scroll, or a drag — and starting the gesture right away
 * would steal all the others. This module owns the wait that resolves the
 * ambiguity, and only then hands over to the real gesture.
 *
 * There is one gesture, with a trigger per pointer:
 * - a dedicated handle ([data-drag-handle]) says it outright: drag on contact
 * - a mouse resolves it by distance — a mouse scrolls with its wheel, so travel
 *   can only mean drag
 * - a finger resolves it by time — travel is exactly what a scroll looks like,
 *   so the only unambiguous signal left is a finger that does NOT move
 *
 * Whichever trigger fired, it has established the intent: the gesture then
 * starts at the first pixel, without a second threshold to cross.
 */

import {
  createDragGestureController,
  isPrimaryButtonEvent,
} from "./drag_gesture.js";

/* iOS shows its callout (Copy / Look Up) and selects the text under the finger
   on a long press, and does not always route that through an event that can be
   refused — see preventContextMenu below for the half that is an event.
   At module scope, and on the markers rather than on the pressed element: it has
   to be true before the finger lands. */
const css = /* css */ `
  [data-drag-handle],
  [data-drag-source] {
    -webkit-touch-callout: none;
  }
  [data-drag-ignore] {
    -webkit-touch-callout: default;
  }
`;
import.meta.css = css;

/**
 * Waits for the user to mean it, then starts a drag gesture.
 *
 * @param {PointerEvent} grabEvent
 *   The `pointerdown` event that may become a drag.
 * @param {function} dragGestureInitializer
 *   Called once the intent is established; must create and return the real drag
 *   gesture (typically via `grabViaPointer(grabEvent)`). Returning a falsy value
 *   aborts the gesture.
 * @param {object} [options]
 * @param {number} [options.threshold=5]
 *   Distance (px) the pointer must travel to start a drag, when the trigger is
 *   distance-based.
 * @param {boolean|"if-touch"} [options.longPress="if-touch"]
 *   Which pointers start a drag by holding still instead of by travelling.
 * @param {number} [options.longPressDelay=400]
 *   How long (ms) the pointer must stay down. Kept under the system context-menu
 *   delay so the object is picked up before the menu would have opened.
 * @param {number} [options.longPressSlop=8]
 *   How far (px) the pointer may drift during the wait before the press is
 *   abandoned — beyond it, the finger is scrolling, not holding.
 * @param {function} [options.onPressStart]
 *   The pointer went down and the wait began (a cue that the press counts).
 * @param {function} [options.onPressCancel]
 *   The pointer moved or lifted before the wait was over.
 * @param {function} [options.onPress]
 *   The wait completed and the object is now held (haptics, scale…).
 */
export const dragAfterIntent = (
  grabEvent,
  dragGestureInitializer,
  {
    threshold = 5,
    longPress = "if-touch",
    longPressDelay = 400,
    longPressSlop = 8,
    onPressStart,
    onPressCancel,
    onPress,
  } = {},
) => {
  if (!isPrimaryButtonEvent(grabEvent)) {
    return;
  }
  const target = grabEvent.target;
  const isDedicatedHandle =
    target.closest && target.closest("[data-drag-handle]");
  if (isDedicatedHandle) {
    startDragGesture(dragGestureInitializer);
    return;
  }
  const startsOnLongPress =
    longPress === true ||
    (longPress === "if-touch" && grabEvent.pointerType === "touch");
  if (startsOnLongPress) {
    dragAfterLongPress(grabEvent, dragGestureInitializer, {
      longPressDelay,
      longPressSlop,
      onPressStart,
      onPressCancel,
      onPress,
    });
    return;
  }
  dragAfterDistance(grabEvent, dragGestureInitializer, threshold);
};

const startDragGesture = (dragGestureInitializer, catchUpEvent) => {
  const dragGesture = dragGestureInitializer();
  if (!dragGesture) {
    return null;
  }
  // The wait is what established the intent; a distance threshold on top of it
  // would ask the user to prove the same thing twice.
  dragGesture.start();
  if (catchUpEvent) {
    dragGesture.dragViaPointer(catchUpEvent);
  }
  return dragGesture;
};

const dragAfterDistance = (grabEvent, dragGestureInitializer, threshold) => {
  const significantDragGestureController = createDragGestureController({
    threshold,
    // allow interaction for this intermediate gesture:
    // user should still be able to scroll or interact with the document
    // only once the gesture is significant we take control
    documentInteractions: "manual",
    onDragStart: (gestureInfo) => {
      significantDragGesture.release(); // kill that gesture
      startDragGesture(dragGestureInitializer, gestureInfo.dragEvent);
    },
  });
  const significantDragGesture =
    significantDragGestureController.grabViaPointer(grabEvent, {
      element: grabEvent.target,
    });
};

const dragAfterLongPress = (
  grabEvent,
  dragGestureInitializer,
  { longPressDelay, longPressSlop, onPressStart, onPressCancel, onPress },
) => {
  const { pointerId, clientX, clientY } = grabEvent;

  const pressCleanupCallbacks = [];
  const endPress = () => {
    for (const pressCleanupCallback of pressCleanupCallbacks) {
      pressCleanupCallback();
    }
    pressCleanupCallbacks.length = 0;
  };

  /*
   * A press held long enough IS the system's context-menu gesture: Android opens
   * its menu around 500ms, iOS its callout — both a tenth of a second after the
   * object has been picked up, landing on top of something the finger is already
   * carrying.
   * The listener goes on window, in capture: once the gesture runs, the drag
   * backdrop covers the page, so the contextmenu event is aimed at the backdrop
   * and never reaches the element being dragged.
   * It is removed on release — a right click with a mouse remains a right click.
   */
  const preventContextMenu = (contextMenuEvent) => {
    contextMenuEvent.preventDefault();
  };
  window.addEventListener("contextmenu", preventContextMenu, true);
  pressCleanupCallbacks.push(() => {
    window.removeEventListener("contextmenu", preventContextMenu, true);
  });

  const countdownCleanupCallbacks = [];
  const endCountdown = () => {
    for (const countdownCleanupCallback of countdownCleanupCallbacks) {
      countdownCleanupCallback();
    }
    countdownCleanupCallbacks.length = 0;
  };

  const timeout = setTimeout(() => {
    endCountdown();
    onPress?.(grabEvent);
    /*
     * Scrolling is taken away now that the object is held, not before: a
     * `touch-action: none` on the element would take it from everyone who merely
     * brushes past it. And it has to be preventDefault on a non-passive
     * touchmove — `touch-action` is read when the touch begins, so setting it
     * here would come too late to have any effect on the touch in progress.
     */
    const preventTouchMove = (touchMoveEvent) => {
      touchMoveEvent.preventDefault();
    };
    window.addEventListener("touchmove", preventTouchMove, {
      passive: false,
      capture: true,
    });
    pressCleanupCallbacks.push(() => {
      window.removeEventListener("touchmove", preventTouchMove, {
        capture: true,
      });
    });

    const dragGesture = startDragGesture(dragGestureInitializer);
    if (!dragGesture) {
      endPress();
      return;
    }
    dragGesture.addReleaseCallback(endPress);
  }, longPressDelay);
  countdownCleanupCallbacks.push(() => {
    clearTimeout(timeout);
  });

  const cancelPress = (pointerEvent) => {
    endCountdown();
    endPress();
    onPressCancel?.(pointerEvent);
  };
  const onPointerMove = (pointerMoveEvent) => {
    if (pointerMoveEvent.pointerId !== pointerId) {
      return;
    }
    const xDrift = Math.abs(pointerMoveEvent.clientX - clientX);
    const yDrift = Math.abs(pointerMoveEvent.clientY - clientY);
    if (xDrift < longPressSlop && yDrift < longPressSlop) {
      return;
    }
    // The finger is going somewhere: it is scrolling the page, or running down
    // the list. Letting the countdown survive would unhook an object in passing.
    cancelPress(pointerMoveEvent);
  };
  const onPointerEnd = (pointerEndEvent) => {
    if (pointerEndEvent.pointerId !== pointerId) {
      return;
    }
    cancelPress(pointerEndEvent);
  };
  // On window rather than on the element: the finger can leave it, and the
  // element itself can be taken out of the document while the press is waiting.
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerEnd);
  window.addEventListener("pointercancel", onPointerEnd);
  countdownCleanupCallbacks.push(() => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerEnd);
    window.removeEventListener("pointercancel", onPointerEnd);
  });

  onPressStart?.(grabEvent);
};
