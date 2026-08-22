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
 *
 * WHEN A FINGER MAY TRAVEL TOO: [data-drag-on-contact].
 *
 * The wait a finger is asked for is not a rule about fingers, it is the answer to
 * an ambiguity — travel means scroll as much as it means drag, so the two have to
 * be told apart. Where nothing scrolls the ambiguity does not exist, and the wait
 * is asking the hand to prove something nothing else could have meant: inside a
 * dialog that holds the page still, a finger travelling on a piece can only be
 * carrying it.
 *
 * So the attribute says that place, not that element — put on the dialog, every
 * source inside it reads by distance like a mouse does, at the same few pixels.
 * A tap is left alone by that: a press that goes nowhere is still a press, which
 * is what a piece that is also a link or a card needs.
 *
 * It is opt-in and cannot be anything else. Nothing here can see whether the
 * surroundings scroll — a page scrolls by default, an overflow is one CSS
 * property away, and getting it wrong the wrong way means the list runs away
 * under the finger that meant to reorder it. Only the application knows it has
 * taken the scroll away.
 */

import { waitForPressHeld } from "../press_held.js";
import {
  createDragGestureController,
  isPrimaryButtonEvent,
} from "./drag_gesture.js";

/* At module scope, and on the markers rather than on the pressed element: both
   rules below have to be true BEFORE the finger lands — a stylesheet, never a
   line of JS in the pointerdown.

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
   lets the page scroll and still makes the refusal effective — provided the
   listener that will refuse is already known too, which is markDragSource's
   half of the same rule. */
const css = /* css */ `
  [data-drag-handle],
  [data-drag-source] {
    -webkit-touch-callout: none;
  }
  [data-drag-handle] {
    /* A dedicated handle has nothing to share: it takes the gesture on contact. */
    touch-action: none;
  }
  [data-drag-source] {
    /* A source taken by long press must let the scroll through until the grab —
       which is exactly what the long press is there to tell apart. Zoom has
       nothing to do with the gesture and nobody should lose it by resting a
       finger on a word.

       Vertical, because that is the way the page and the lists in it go: a
       source dragged along one axis is surrounded by something scrolling along
       that same axis (a row of a list runs the way the list scrolls), and a
       source dragged both ways sits on the usual vertical page. */
    touch-action: pan-y pinch-zoom;
  }
  [data-drag-source="x"] {
    /* …and the sideways one, for the same reason read the other way. */
    touch-action: pan-x pinch-zoom;
  }
  [data-drag-on-contact] [data-drag-source],
  [data-drag-source][data-drag-on-contact] {
    /* Nothing scrolls here, so there is no pan to leave to anyone — the finger
       may travel from the first pixel. Zoom is kept: it belongs to the reader,
       not to the gesture, and two fingers are never a drag. */
    touch-action: pinch-zoom;
  }
  [data-drag-ignore] {
    -webkit-touch-callout: default;
    touch-action: auto;
  }
`;
import.meta.css = css;

/*
 * A press that may become a drag has to be refusable before anyone knows it is
 * one. WHETHER a touchmove can be refused at all is decided when the touch
 * BEGINS, from the non-passive listeners the browser knows about at that
 * moment — and on the long press path the gesture, which is what refuses it
 * (see preventTouchScroll in drag_gesture.js), is only born once the wait is
 * over. Put down from the pointerdown it is already too late: every touchmove
 * handed over is `cancelable: false`, the refusal does nothing, and the page
 * scrolls away with the object still under the finger — until the touch is
 * taken for a scroll and the pointer stream is cancelled, which is the drag
 * dying mid-gesture, released where it stood.
 *
 * So it goes down with the element, next to the attribute the stylesheet above
 * reads: same rule, same moment. It refuses nothing itself — a press that is
 * still only a press must leave the scroll alone, which is exactly what the wait
 * is there to tell apart. Being there is the whole of it.
 *
 * On the element and not on the window, so the rest of the page keeps its
 * touches on the compositor's fast path.
 *
 * Exported because a drag does not always begin on a drag source: a copy caught
 * on its way home is pressed through the pictures of a view transition, and the
 * touch lands on the document root (see letCopyBeCaught in drag_to.js). Same
 * rule, other element — and it has to be the same function, or the listener put
 * down is not the one taken back off.
 */
export const keepTouchRefusable = () => {
  // Being registered IS the whole of it — see above.
};

/**
 * Says an element is something a drag can start from, and which way that drag
 * goes.
 *
 * The axes are written in the DOM rather than kept here because they are what
 * someone ELSE reads: a box above this one that travels under the same finger
 * (a row of slides, a sheet pushed down to close it) has to know which axes are
 * already spoken for before it answers the press — the same thing a travel says
 * about itself with `data-travel-by-drag`. It is also what leaves the browser
 * the pan it may still do until the grab (see the stylesheet above).
 *
 * @param {Element} element
 * @param {"x"|"y"|"xy"} [axes="xy"]
 *   Which way the drag walks. A list reordered along its own line says `"y"`;
 *   something carried across a board, or thrown, goes both ways.
 * @returns {function} Takes the mark back off.
 */
export const markDragSource = (element, axes = "xy") => {
  element.setAttribute("data-drag-source", axes);
  element.addEventListener("touchmove", keepTouchRefusable, { passive: false });
  return () => {
    element.removeAttribute("data-drag-source");
    element.removeEventListener("touchmove", keepTouchRefusable);
  };
};

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
 *   `"if-touch"` excepts what stands inside a `[data-drag-on-contact]`, where
 *   nothing scrolls and a finger resolves by distance like a mouse.
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
    (longPress === "if-touch" &&
      grabEvent.pointerType === "touch" &&
      // The wait tells a scroll from a drag, and here there is no scroll to tell
      // it from — see [data-drag-on-contact] at the top of this file.
      !(target.closest && target.closest("[data-drag-on-contact]")));
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
      // This one owns nothing: it measures a distance to find out whether there
      // is a gesture at all, and it is over the moment there is. Taking the
      // pointer for that would take it from whoever is already holding this same
      // element for a gesture of their own — and giving it back at the threshold
      // would tell them theirs is over.
      pointerCaptureDeferred: true,
    });
};

const dragAfterLongPress = (
  grabEvent,
  dragGestureInitializer,
  { longPressDelay, longPressSlop, onPressStart, onPressCancel, onPress },
) => {
  /*
   * Nothing is done here to keep the touch refusable: whether it can be refused
   * at all was settled when the finger landed, from what the element already
   * carried (see markDragSource). Scrolling is then taken away by the gesture
   * itself, from the moment it starts (see preventTouchScroll in
   * drag_gesture.js) — one place refuses the touchmove, for every way a drag can
   * begin.
   */
  waitForPressHeld(grabEvent, {
    delay: longPressDelay,
    slop: longPressSlop,
    onPressStart,
    onPressCancel,
    onPressHeld: (pressEvent, { endPress }) => {
      onPress?.(pressEvent);
      const dragGesture = startDragGesture(dragGestureInitializer);
      if (!dragGesture) {
        endPress();
        return;
      }
      dragGesture.addReleaseCallback(() => {
        endPress();
      });
    },
  });
};
