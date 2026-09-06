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
 * WHEN IT HAS THE HAND is told, and it is the one thing nobody else can see. The
 * capture taken at that instant is not that word: the browser announces one just
 * before the NEXT pointer event, so a finger held still and then kept still is
 * announced nothing at all, and a finger that moves hears it at the same moment
 * the surface is already panning under it — the answer arrives with the movement
 * it was supposed to precede. So `onGrab` says it where it happens, and
 * `data-grabbed` says the same in the DOM, since what it is usually for is a
 * contour and a veil.
 *
 * A SURFACE STANDING IN SOMETHING THAT SCROLLS: `afterHold`, and the wheel.
 *
 * Travel is only unambiguous where there is no scroll to tell it apart from. A
 * plan shown as a thumbnail in the middle of a page is the other case: a finger
 * landing on it means to scroll the page nine times out of ten, and a surface
 * taking every touch makes the page unreadable past it. `afterHold` gives that
 * surface the drag sources' answer — a finger says it means THIS one by staying
 * still — and leaves the touch to the page until the wait is over: the page
 * keeps its scroll (see the stylesheet), the surface keeps the pinch, and the
 * pan begins where the finger already is. A mouse travelling is untouched by it:
 * a button held down over a surface could never have meant a scroll.
 *
 * `afterHold: "kept"` is that same wait, asked for once: the surface that has
 * been given the hand keeps it — panning on contact, the way it always does
 * under a mouse — until a pointer goes down away from it, which is the hand
 * saying it has moved on. Nothing disputes the touch in between: the finger
 * that stood still has already said it was not scrolling, and asking it to say
 * so again before every pan is asking three times for one sentence. That
 * in-between — the hand kept with nothing touching the surface — is
 * `data-hand-kept` in the DOM, since it is a state to be drawn and nothing else
 * names it: `data-grabbed` is a hand actually on it.
 *
 * ITS WHEEL IS THE OTHER HALF of the same question, and the answer is not the
 * same word. A wheel over a surface in a page means to scroll that page nine
 * times out of ten — it is what a wheel means everywhere else, and a surface
 * taking it makes the page unreadable past it exactly the way the finger did.
 * But a wheel is not a touch: what a touch may do is settled before it lands, by
 * `touch-action`, so nothing can be read to decide it — whereas a wheel event is
 * READ, and by then what scrolls around the surface can simply be looked up. So
 * this one is not asked of the caller: a bare wheel zooms where nothing around
 * would have scrolled (a map filling the screen, a board in a modal), and asks
 * for `ctrl`/`meta` where something would — which is also the trackpad pinch's
 * own modifier, so the pinch keeps zooming untouched. `wheelZoom: "always"` is
 * for the surface that wants it back.
 */

import { suppressClickAfterGesture } from "../click_suppression.js";
import { waitForPressHeld } from "../press_held.js";
import { canScroll, getScrollingElement } from "../scroll/is_scrollable.js";
import {
  claimWheelGesture,
  wheelGestureIsTakenFrom,
} from "../scroll/wheel_gesture.js";
import { dragSourceThatStoodDown } from "./drag_after_intent.js";
import { isPrimaryButtonEvent } from "./drag_gesture.js";
import { DRAG_EXCLUDED_SELECTOR } from "./drag_to_travel.js";

const SURFACE_ATTRIBUTE = "data-pan-zoom-surface";
// The same word a carried element says while the gesture has it (see drag_to.js):
// a surface holding the hand is grabbed, and one thing held is like another.
const GRABBED_ATTRIBUTE = "data-grabbed";
// The surface holds the hand, whether or not anything is touching it right now:
// what `afterHold: "kept"` leaves behind between two gestures, and the state the
// wait was paid for.
const HAND_KEPT_ATTRIBUTE = "data-hand-kept";

const css = /* css */ `
  [data-pan-zoom-surface] {
    /* The browser would pan the page and pinch-zoom it from a touch landing
       here, and what a touch may do is settled when it lands — so it is said
       from a stylesheet, on the surface, before any finger. Both gestures are
       what the surface answers with its own numbers. */
    touch-action: none;
    /* Nothing under a hand dragging a surface is text to select, and iOS answers
       a finger standing still on it with its callout otherwise. */
    user-select: none;
    -webkit-touch-callout: none;
  }
  [data-pan-zoom-surface="after-hold"] {
    /* Until the hold is over the touch is the page's: this surface stands in
       something that scrolls and does not know which way it goes, so both axes
       are left to it. The pinch is not — two fingers on a surface that answers
       zoom are its own gesture, whatever the page behind would have done with
       them. Being an explicit value rather than auto is also what keeps a
       touchmove refusable once the hold lands (see preventTouchScroll below). */
    touch-action: pan-x pan-y;
  }
`;
import.meta.css = css;

// How far a wheel travels to double the zoom, or halve it: about three notches
// of a mouse. A trackpad pinch arrives as a wheel too (ctrl held, small deltas,
// many events) and reads the same way.
const WHEEL_DISTANCE_PER_DOUBLING = 300;
const WHEEL_LINE_HEIGHT = 16;
const WHEEL_PAGE_HEIGHT = 400;
// How long a silence ends a wheel burst, for the answer given to its first
// event: the same delay wheel_gesture.js reads a gesture's end from.
const WHEEL_BURST_END_DELAY = 150;

/**
 * Would a wheel over this surface have scrolled something if the surface did
 * not answer it? Asked at the moment of the wheel rather than settled at setup:
 * what scrolls around a box changes with the page, and unlike a touch — whose
 * fate is sealed before it lands — a wheel event is there to be read.
 *
 * The walk stops at a modal: what is behind one is not what a wheel over it is
 * for, whether or not the browser still lets it scroll.
 */
const wheelWouldScrollAround = (element) => {
  let node = element.parentElement;
  while (node) {
    if (canScroll(node, "y") || canScroll(node, "x")) {
      return true;
    }
    if (node.tagName === "DIALOG" && node.matches(":modal")) {
      return false;
    }
    node = node.parentElement;
  }
  return pageScrolls(element.ownerDocument);
};

// The viewport is the scroll container nothing declares: `overflow` computes to
// `visible` on the document element even while the page scrolls, so it is read
// from the size it has to go through — and from what a page locks itself with
// while something is open in front of it.
const pageScrolls = (document) => {
  const { documentElement, body, defaultView } = document;
  if (!documentElement || !defaultView) {
    return false;
  }
  for (const node of [documentElement, body]) {
    if (!node) {
      continue;
    }
    const { overflowY } = defaultView.getComputedStyle(node);
    if (overflowY === "hidden" || overflowY === "clip") {
      return false;
    }
  }
  const scroller = getScrollingElement(document) || documentElement;
  return scroller.scrollHeight - scroller.clientHeight > 1;
};

// What a press on the surface is NOT for it: what answers the pointer on its own
// (a field, a handle, a popover…), what is carried across the surface (a drag
// source, a thing that said the press is its own), and a surface inside this
// one. The nearest word wins: the surface is in the list too, so a press on it
// or on plain content in it finds the surface first.
const YIELDED_SELECTOR = `${DRAG_EXCLUDED_SELECTOR},[data-drag-source],[data-drag-ignore],[${SURFACE_ATTRIBUTE}]`;

/**
 * The surface this element stands on, if any: what a gesture that gives itself
 * up asks, to know whether there is anyone to give it up TO (see refuseDragTo in
 * drag_to.js).
 *
 * @param {Element} element
 * @returns {Element|null}
 */
export const findPanZoomSurface = (element) => {
  return element.closest(`[${SURFACE_ATTRIBUTE}]`);
};

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
 * @param {(detail: {event: PointerEvent}) => void} [options.onGrab]
 *   The surface has the hand: the travel proved it, the hold landed, or a second
 *   pointer came down. Told once, before the first report, and `data-grabbed` is
 *   on the element for as long as it lasts.
 * @param {(detail: {event: PointerEvent|undefined}) => void} [options.onRelease]
 *   The last pointer is gone — let go of, taken away, or the surface itself
 *   taken down under the hand, which is the one case with no event to show.
 * @param {(detail: {event: WheelEvent}) => void} [options.onWheelLeftToPage]
 *   A bare wheel was left to what scrolls around the surface rather than zooming
 *   it: the zoom is one `ctrl`/`meta` away, and this is where that is said.
 * @param {number} [options.threshold=5] How far a pointer travels before it pans.
 * @param {boolean|"kept"} [options.afterHold=false] Whether a FINGER must be held
 *   still before it pans, the page keeping its scroll until then. For a surface
 *   standing in something that scrolls; a mouse pans by travelling either way.
 *   `"kept"` asks for the wait once: from the moment the surface has the hand it
 *   pans on contact, and it asks again only after a pointer has gone down away
 *   from it. `data-hand-kept` is on the element for as long as it holds the hand
 *   that way, a hand touching it or not.
 * @param {"auto"|"always"} [options.wheelZoom="auto"] Whether a BARE wheel zooms.
 *   `"auto"` gives it to whatever scrolls around the surface when there is one,
 *   and zooms when there is none; `"always"` takes it back, for a surface that
 *   owns the wheel whatever stands around it. `ctrl`/`meta` zooms either way.
 * @returns {() => void} Takes it all back.
 */
export const installPanZoom = (
  element,
  {
    onPan,
    onZoom,
    onGrab,
    onRelease,
    onWheelLeftToPage,
    threshold = 5,
    afterHold,
    wheelZoom = "auto",
  } = {},
) => {
  // Whether a finger still owes the wait. Constant under a plain `afterHold`;
  // under `"kept"` it is spent the first time the surface is given the hand and
  // asked for again once the hand has gone elsewhere.
  let holdIsOwed = Boolean(afterHold);
  const reflectHoldOwed = () => {
    // What a touch may do is settled before it lands, so the mode is in the DOM
    // rather than read at pointerdown (see the stylesheet).
    element.setAttribute(SURFACE_ATTRIBUTE, holdIsOwed ? "after-hold" : "");
    if (afterHold !== "kept") {
      // A surface that answers on contact was never given anything to keep.
      return;
    }
    if (holdIsOwed) {
      element.removeAttribute(HAND_KEPT_ATTRIBUTE);
    } else {
      element.setAttribute(HAND_KEPT_ATTRIBUTE, "");
    }
  };
  reflectHoldOwed();
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

  // A press somewhere else, while the surface holds nothing: the hand has moved
  // on, and the next finger landing here is disputed again. A press on the
  // surface, or one made while it already has the hand (a second finger resting
  // beside it), is not that.
  const onPointerDownAway = (event) => {
    if (pointers.size > 0 || element.contains(event.target)) {
      return;
    }
    holdIsOwed = true;
    reflectHoldOwed();
    window.removeEventListener("pointerdown", onPointerDownAway, true);
  };
  const keepTheHand = () => {
    holdIsOwed = false;
    reflectHoldOwed();
    window.addEventListener("pointerdown", onPointerDownAway, true);
  };

  const activate = (anchorWhere, event) => {
    active = true;
    if (afterHold === "kept" && holdIsOwed) {
      // Asked for and given: whatever proved it — the hold, a second finger, a
      // mouse travelling — the surface is the hand's from here.
      keepTheHand();
    }
    for (const pointerId of pointers.keys()) {
      element.setPointerCapture(pointerId);
    }
    anchor = readHand(anchorWhere);
    // The click the release leaves behind is not for what is under the hand.
    disarmClickSuppression = suppressClickAfterGesture();
    // The surface has the hand, and this is the only place that knows (see the
    // top of this file). Said in the DOM first, so a stylesheet alone can draw
    // it, and before the first report, so what is drawn is drawn before the
    // surface has moved under it.
    element.setAttribute(GRABBED_ATTRIBUTE, "");
    onGrab?.({ event });
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

  const end = (event) => {
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
      element.removeAttribute(GRABBED_ATTRIBUTE);
      onRelease?.({ event });
    }
  };

  const onPointerDown = (event) => {
    // A secondary button (right click and friends) is a context menu.
    if (!isPrimaryButtonEvent(event)) {
      return;
    }
    let yieldedTo = event.target.closest(YIELDED_SELECTOR);
    if (yieldedTo && yieldedTo === dragSourceThatStoodDown(event)) {
      // It is a drag source and it carries nothing from this press
      // (standDownFromPress), so it is no reason to yield — and the walk goes on
      // above it, where a field, a nested surface or something that IS being
      // carried would still be.
      yieldedTo = yieldedTo.parentElement?.closest(YIELDED_SELECTOR) || null;
    }
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
      activate("now", event);
      return;
    }
    if (holdIsOwed && event.pointerType === "touch") {
      pointer.waitsForHold = true;
      pointer.holdWait = waitForPressHeld(event, {
        // Anchored where the finger IS: it has barely moved, so there is
        // nothing to catch up with.
        onPressHeld: (pressEvent) => {
          activate("now", pressEvent);
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
      activate("start", event);
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
    // and saying it here, where the finger is gone too, is what gives the
    // context menu back (see press_held.js).
    pointer.holdWait?.cancel();
    if (pointers.size === 0) {
      end(event);
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

  // What the first event of the burst going on settled: a key let go of (or
  // pressed) halfway through must not hand a zoom to the page mid-gesture, and
  // a burst has no end but a silence.
  let wheelBurstAnswer = null;
  let wheelBurstTimeout = null;
  const rememberWheelBurst = (answer) => {
    wheelBurstAnswer = answer;
    clearTimeout(wheelBurstTimeout);
    wheelBurstTimeout = setTimeout(() => {
      wheelBurstAnswer = null;
    }, WHEEL_BURST_END_DELAY);
    return answer;
  };

  const readWheelAnswer = (event) => {
    // The modifier a trackpad pinch already arrives with: the same gesture two
    // fingers make on a phone, and never the page's.
    if (event.ctrlKey || event.metaKey) {
      return "zoom";
    }
    if (wheelZoom === "always") {
      return "zoom";
    }
    return wheelWouldScrollAround(element) ? "page" : "zoom";
  };

  const onWheel = (event) => {
    // A burst somebody above is already answering (a row of slides travelling
    // under the wheel) is theirs; one that began here is held for as long as it
    // lasts, so drifting over the edge does not hand its tail to the page.
    if (wheelGestureIsTakenFrom(element)) {
      return;
    }
    // Renewed on every event of the burst: the silence after the last one is
    // what ends it.
    const answer = rememberWheelBurst(
      wheelBurstAnswer || readWheelAnswer(event),
    );
    if (answer === "page") {
      // Nothing is claimed and nothing is prevented: the scroll this wheel was
      // for happens, and the word that would explain the zoom is said above.
      onWheelLeftToPage?.({ event });
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
    clearTimeout(wheelBurstTimeout);
    pointers.clear();
    element.removeEventListener("pointerdown", onPointerDown);
    element.removeEventListener("lostpointercapture", onLostPointerCapture);
    element.removeEventListener("touchmove", preventTouchScroll);
    element.removeEventListener("wheel", onWheel);
    window.removeEventListener("pointerdown", onPointerDownAway, true);
    element.removeAttribute(SURFACE_ATTRIBUTE);
    element.removeAttribute(HAND_KEPT_ATTRIBUTE);
    element.removeAttribute("data-no-drag-travel");
  };
};
