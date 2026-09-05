/**
 * A surface under the hand: panned by one pointer, zoomed between two — or
 * under a wheel.
 *
 * One reader for all of it, because the three parts have to agree and cannot
 * from three places: the pan must step back for something carried ACROSS the
 * surface (a marker declaring `move`, a handle), the pinch must not begin as a
 * pan under its first finger, and the wheel and the pinch have to write the same
 * zoom. So the surface says what a pointer landing on it may do (`touch-action:
 * none`, from the stylesheet, since a browser decides that when the touch
 * begins), and every press on it that nothing inside has claimed is read here.
 *
 * WHAT COMES OUT is a stream, not an outcome: `onPan({ x, y })` says how far the
 * hand has moved since the last report, `onZoom({ factor, x, y })` by how much
 * the zoom changed and around which point of the surface. What a pixel of pan
 * means in the caller's coordinates, and whether a zoom is continuous or
 * stepped, is the caller's — the numbers are the numbers.
 *
 * TWO FINGERS are one gesture: the point between them is what pans, the
 * distance between them is what zooms, and both are reported on every frame —
 * the zoom first, around the point the fingers WERE, then the pan by how far
 * that point went. A finger lifting re-anchors on what is left, so nothing
 * jumps.
 *
 * A pointer starts nothing until it has travelled `threshold` px: a finger
 * landing on a surface with `touch-action: none` has no scroll to be told apart
 * from, but it may still be a tap, or the beginning of a hold that something on
 * the surface is waiting for — and a capture is what abandons a pending hold
 * (see press_held.js), so none is taken before the travel. A second pointer
 * landing is intent enough on its own. The first pixels are not lost: the
 * surface catches up with the finger the moment the pan begins.
 *
 * A SURFACE STANDING IN SOMETHING THAT SCROLLS: `afterHold`.
 *
 * Travel is only unambiguous where there is no scroll to tell it apart from. A
 * plan shown as a thumbnail in the middle of a page is the other case: a finger
 * landing on it means to scroll the page nine times out of ten, and a surface
 * taking every touch makes the page unreadable past it. `afterHold` gives that
 * surface the drag sources' answer — a finger says it means THIS one by staying
 * still — and leaves the touch to the page until the wait is over: the page
 * keeps its scroll (see the stylesheet), the surface keeps the pinch, and the
 * pan begins where the finger already is. A mouse is untouched by it: its wheel
 * is what scrolls the page, so travel over the surface could never have meant
 * anything else.
 */

import { suppressClickAfterGesture } from "../click_suppression.js";
import { waitForPressHeld } from "../press_held.js";
import {
  claimWheelGesture,
  wheelGestureIsTakenFrom,
} from "../scroll/wheel_gesture.js";
import { isPrimaryButtonEvent } from "./drag_gesture.js";
import { DRAG_EXCLUDED_SELECTOR } from "./drag_to_travel.js";

const SURFACE_ATTRIBUTE = "data-pan-zoom-surface";

const css = /* css */ `
  [data-pan-zoom-surface] {
    /* The browser would pan the page and pinch-zoom it from a touch landing
       here, and what a touch may do is settled when it lands — so it is said
       from a stylesheet, on the surface, before any finger. Both gestures are
       what the surface answers with its own numbers. */
    touch-action: none;
    /* Nothing under a hand dragging a surface is text to select. */
    user-select: none;
  }
  [data-pan-zoom-surface="after-hold"] {
    /* Until the hold is over the touch is the page's: this surface stands in
       something that scrolls and does not know which way it goes, so both axes
       are left to it. The pinch is not — two fingers on a surface that answers
       zoom are its own gesture, whatever the page behind would have done with
       them. Being an explicit value rather than auto is also what keeps a
       touchmove refusable once the hold lands (see preventTouchScroll below). */
    touch-action: pan-x pan-y;
    /* iOS answers a long press with its callout and by selecting under the
       finger, a tenth of a second after the wait below was answered. */
    -webkit-touch-callout: none;
  }
`;
import.meta.css = css;

// How far a wheel travels to double the zoom, or halve it: about three notches
// of a mouse. A trackpad pinch arrives as a wheel too (ctrl held, small deltas,
// many events) and reads the same way.
const WHEEL_DISTANCE_PER_DOUBLING = 300;
const WHEEL_LINE_HEIGHT = 16;
const WHEEL_PAGE_HEIGHT = 400;

// What a press on the surface is NOT for it: what answers the pointer on its own
// (a field, a handle, a popover…), what is carried across the surface (a drag
// source, a thing that said the press is its own), and a surface inside this
// one. The nearest word wins: the surface is in the list too, so a press on it
// or on plain content in it finds the surface first.
const YIELDED_SELECTOR = `${DRAG_EXCLUDED_SELECTOR},[data-drag-source],[data-drag-ignore],[${SURFACE_ATTRIBUTE}]`;

/**
 * Makes an element a surface that pans under the hand and zooms between two
 * fingers or under a wheel.
 *
 * @param {Element} element
 * @param {object} options
 * @param {(detail: {event: PointerEvent, x: number, y: number}) => void} [options.onPan]
 *   The hand moved: `x`/`y` are how far since the last report, in px.
 * @param {(detail: {event: PointerEvent|WheelEvent, factor: number, x: number, y: number}) => void} [options.onZoom]
 *   The zoom changed by `factor` (above 1 is in) around the point `x`/`y` of the
 *   surface, measured inside its border. Left out, a wheel over the surface is
 *   left to the page, and two fingers only pan.
 * @param {number} [options.threshold=5] How far a pointer travels before it pans.
 * @param {boolean} [options.afterHold=false] Whether a FINGER must be held still
 *   before it pans, the page keeping its scroll until then. For a surface
 *   standing in something that scrolls; a mouse pans by travelling either way.
 * @returns {() => void} Takes it all back.
 */
export const installPanZoom = (
  element,
  { onPan, onZoom, threshold = 5, afterHold } = {},
) => {
  element.setAttribute(SURFACE_ATTRIBUTE, afterHold ? "after-hold" : "");
  // A travelling box above must not take the press this reads (see
  // drag_to_travel.js): the surface says so itself, being the one that knows.
  element.setAttribute("data-no-drag-travel", "");

  // Every pointer down on the surface, where it is and where it landed.
  const pointers = new Map();
  let active = false;
  // Where the hand was at the last report: the point between the pointers, and
  // the distance between the first two.
  let anchor = null;
  let disarmClickSuppression = null;

  const pointOnSurface = (clientX, clientY) => {
    const rect = element.getBoundingClientRect();
    return {
      x: clientX - rect.left - element.clientLeft,
      y: clientY - rect.top - element.clientTop,
    };
  };

  const readHand = (where = "now") => {
    let sumX = 0;
    let sumY = 0;
    for (const pointer of pointers.values()) {
      sumX += where === "now" ? pointer.x : pointer.startX;
      sumY += where === "now" ? pointer.y : pointer.startY;
    }
    const count = pointers.size;
    const hand = { x: sumX / count, y: sumY / count, distance: 0 };
    if (count >= 2) {
      const [first, second] = pointers.values();
      hand.distance =
        where === "now"
          ? Math.hypot(second.x - first.x, second.y - first.y)
          : Math.hypot(
              second.startX - first.startX,
              second.startY - first.startY,
            );
    }
    return hand;
  };

  const activate = (anchorWhere) => {
    active = true;
    for (const pointerId of pointers.keys()) {
      element.setPointerCapture(pointerId);
    }
    anchor = readHand(anchorWhere);
    // The click the release leaves behind is not for what is under the hand.
    disarmClickSuppression = suppressClickAfterGesture();
  };

  const report = (event) => {
    const hand = readHand();
    if (onZoom && anchor.distance && hand.distance) {
      const factor = hand.distance / anchor.distance;
      if (factor !== 1) {
        onZoom({ event, factor, ...pointOnSurface(anchor.x, anchor.y) });
      }
    }
    const x = hand.x - anchor.x;
    const y = hand.y - anchor.y;
    if (onPan && (x || y)) {
      onPan({ event, x, y });
    }
    anchor = hand;
  };

  const end = () => {
    for (const pointer of pointers.values()) {
      pointer.holdWait?.cancel();
    }
    window.removeEventListener("pointermove", onPointerMove, true);
    window.removeEventListener("pointerup", onPointerEnd, true);
    window.removeEventListener("pointercancel", onPointerEnd, true);
    if (active) {
      active = false;
      anchor = null;
      disarmClickSuppression();
      disarmClickSuppression = null;
    }
  };

  const onPointerDown = (event) => {
    // A secondary button (right click and friends) is a context menu.
    if (!isPrimaryButtonEvent(event)) {
      return;
    }
    const yieldedTo = event.target.closest(YIELDED_SELECTOR);
    if (yieldedTo && yieldedTo !== element && element.contains(yieldedTo)) {
      return;
    }
    if (pointers.size === 0) {
      // On the window rather than on the surface, filtered by id: nothing is
      // captured until the travel proves the intent, and a pointer that leaves
      // the surface meanwhile must still be heard.
      window.addEventListener("pointermove", onPointerMove, true);
      window.addEventListener("pointerup", onPointerEnd, true);
      window.addEventListener("pointercancel", onPointerEnd, true);
    }
    const pointer = {
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      // A finger this surface asked to stand still: whatever it does next, it
      // does not pan by travelling — the travel it makes is the page scrolling.
      waitsForHold: false,
      holdWait: null,
    };
    pointers.set(event.pointerId, pointer);
    if (active) {
      element.setPointerCapture(event.pointerId);
      anchor = readHand();
      return;
    }
    if (pointers.size >= 2) {
      activate("now");
      return;
    }
    if (afterHold && event.pointerType === "touch") {
      pointer.waitsForHold = true;
      pointer.holdWait = waitForPressHeld(event, {
        // Anchored where the finger IS: it has barely moved, so there is
        // nothing to catch up with.
        onPressHeld: () => {
          activate("now");
        },
      });
    }
  };

  const onPointerMove = (event) => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) {
      return;
    }
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (!active) {
      if (pointer.waitsForHold) {
        return;
      }
      const travelled = Math.hypot(
        pointer.x - pointer.startX,
        pointer.y - pointer.startY,
      );
      if (travelled < threshold) {
        return;
      }
      // Anchored where the hand LANDED: the pixels that proved the intent are
      // replayed by the first report, so the surface catches up with the finger
      // rather than starting from under it.
      activate("start");
    }
    report(event);
  };

  const onPointerEnd = (event) => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) {
      return;
    }
    pointers.delete(event.pointerId);
    // What the held press means outlives the wait, so its end is ours to say —
    // and saying it is what gives the context menu back (see press_held.js).
    pointer.holdWait?.cancel();
    if (pointers.size === 0) {
      end();
      return;
    }
    if (active) {
      anchor = readHand();
    }
  };

  // A capture that goes while the pointer is still down is the browser dropping
  // it (or another gesture taking it): that pointer is over for this one. After
  // a pointerup it has already been let go of, and this says nothing.
  const onLostPointerCapture = (event) => {
    if (active) {
      onPointerEnd(event);
    }
  };

  // Whether a touchmove can be refused AT ALL is decided when the touch begins,
  // from the non-passive listeners the browser knows about then — and here the
  // gesture that would refuse it is not born until the hold is over. So the
  // listener goes down with the surface and refuses nothing until the surface is
  // the one moving: before that the page is scrolling, which is the whole point
  // of the wait. Only in `afterHold`; a surface at `touch-action: none` has
  // already been left nothing to refuse.
  const preventTouchScroll = (touchMoveEvent) => {
    if (active && touchMoveEvent.cancelable) {
      touchMoveEvent.preventDefault();
    }
  };

  const onWheel = (event) => {
    // A burst somebody above is already answering (a row of slides travelling
    // under the wheel) is theirs; one that began here is held for as long as it
    // lasts, so drifting over the edge does not hand its tail to the page.
    if (wheelGestureIsTakenFrom(element)) {
      return;
    }
    claimWheelGesture(element);
    // Taken whole, whichever way it leans: the browser would scroll the page
    // with it, or on a laptop read a sideways swipe as "go back".
    event.preventDefault();
    const deltaY =
      event.deltaMode === 1
        ? event.deltaY * WHEEL_LINE_HEIGHT
        : event.deltaMode === 2
          ? event.deltaY * WHEEL_PAGE_HEIGHT
          : event.deltaY;
    if (!deltaY) {
      return;
    }
    onZoom({
      event,
      factor: 2 ** (-deltaY / WHEEL_DISTANCE_PER_DOUBLING),
      ...pointOnSurface(event.clientX, event.clientY),
    });
  };

  element.addEventListener("pointerdown", onPointerDown);
  element.addEventListener("lostpointercapture", onLostPointerCapture);
  if (afterHold) {
    element.addEventListener("touchmove", preventTouchScroll, {
      passive: false,
    });
  }
  if (onZoom) {
    element.addEventListener("wheel", onWheel, { passive: false });
  }

  return () => {
    end();
    pointers.clear();
    element.removeEventListener("pointerdown", onPointerDown);
    element.removeEventListener("lostpointercapture", onLostPointerCapture);
    element.removeEventListener("touchmove", preventTouchScroll);
    element.removeEventListener("wheel", onWheel);
    element.removeAttribute(SURFACE_ATTRIBUTE);
    element.removeAttribute("data-no-drag-travel");
  };
};
