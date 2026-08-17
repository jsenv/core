/**
 * When a press becomes a drag.
 *
 * A pointer going down on a draggable element is ambiguous — it may be a click,
 * a text selection, a scroll, or a drag — and starting the gesture right away
 * would steal all the others. This module picks which signal resolves the
 * ambiguity for the pointer at hand, and only then hands over to the real
 * gesture.
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

import { waitForPressHeld } from "../press_held.js";
import {
  createDragGestureController,
  isPrimaryButtonEvent,
} from "./drag_gesture.js";

/* At module scope, and on the markers rather than on the pressed element: every
   rule below has to be true BEFORE the press — a stylesheet, never a line of JS
   in the pointerdown.

   -webkit-touch-callout: iOS shows its callout (Copy / Look Up) and selects the
   text under the finger on a long press, and does not always route that through
   an event that can be refused — see preventContextMenu below for the half that
   is an event.

   touch-action: a touchmove can only be refused if the region was out of the
   compositor's fast path when the touch BEGAN (see preventTouchScroll in
   drag_gesture.js, which does the refusing). Left at `auto`, Chrome has already
   decided the touch is its own by the time a long press turns into a grab, and
   every preventDefault from then on is a "Unable to preventDefault inside
   passive event listener" intervention — on Android, a scroll that runs away
   with the object. Any explicit value other than `auto` is enough: `pan-y` still
   lets the page scroll and still makes the refusal effective. */
const css = /* css */ `
  [data-drag-handle],
  [data-drag-source] {
    -webkit-touch-callout: none;
    /* A mouse pressed on text selects it from the first pixel, while this is
       still spending a few of them deciding whether the press is a drag at all.
       By the time it is one, a blue trail is already there — and clearing it
       afterwards only half works, because a selection already under way goes on
       being extended as long as the button is down. So it is refused instead, and
       refused BEFORE the press: an element that says it is a drag source has said
       the press is about the drag. */
    user-select: none;
  }
  [data-drag-handle] {
    /* A dedicated handle has nothing to share: it takes the gesture on contact. */
    touch-action: none;
  }
  [data-drag-source] {
    /* A source taken by long press must let the scroll through until the grab —
       which is exactly what the long press is there to tell apart. Zoom has
       nothing to do with the gesture and nobody should lose it by resting a
       finger on a word. */
    touch-action: pan-y pinch-zoom;
  }
  [data-drag-source="x"] {
    /* The axis is the one thing the caller has to say, being the only one who
       knows which way what surrounds the source scrolls. */
    touch-action: pan-x pinch-zoom;
  }
  [data-drag-ignore] {
    -webkit-touch-callout: default;
    touch-action: auto;
    user-select: auto;
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
  waitForPressHeld(grabEvent, {
    delay: longPressDelay,
    slop: longPressSlop,
    onPressStart,
    onPressCancel,
    onPressHeld: (pressEvent, { endPress }) => {
      onPress?.(pressEvent);
      // Scrolling is taken away by the gesture itself, from the moment it starts
      // (see markAsStarted in drag_gesture.js) — one place refuses the touchmove,
      // for every way a drag can begin.
      const dragGesture = startDragGesture(dragGestureInitializer);
      if (!dragGesture) {
        endPress();
        return;
      }
      dragGesture.addReleaseCallback(endPress);
    },
  });
};
