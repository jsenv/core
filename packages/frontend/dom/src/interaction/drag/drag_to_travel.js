/**
 * What a drag means when it TRAVELS: a whole screen pushed aside to bring in the
 * next one — slides inside one box, pages that are URLs.
 *
 * The pointer itself is not read here: reading a press, waiting for it to become
 * a gesture, capturing it, measuring how fast it goes, swallowing the click it
 * would have made is one gesture system for the whole codebase
 * (@jsenv/dom's drag_gesture + drag_after_intent), and this asks it for the
 * plain version — nothing carried, so no backdrop over the page, nothing made
 * inert, no focus taken: a screen slides and the page keeps its scrolling and
 * its keyboard.
 *
 * What IS here is everything that makes a travel a travel rather than a
 * carry — and it is policy, not plumbing:
 * - the axis is LOCKED by the first movement, instead of being constrained
 *   ahead of time;
 * - a press becomes a gesture by distance for every pointer, finger included:
 *   a swipe is a travel, and asking a finger to hold still first (the rule for
 *   picking an object up) would mean waiting before being allowed to swipe;
 * - what travels walks ONE BOX, resists past its ends, and is measured from
 *   where the finger is once it gets there — unless the caller has another box
 *   to offer at that edge, and then the gesture walks on into it;
 * - letting go is a question with an answer: a third of a box, or a flick.
 *
 * What is NOT here is geometry: how big a box is, what lies one step that way,
 * what to paint while the finger moves. The caller knows those and nothing else
 * does — this reads the gesture and calls back.
 *
 * Who owns a gesture is decided in three places, and all three are read here:
 * - what says so itself, with [data-no-drag-travel] or by being a field — a
 *   component that reads the pointer marks itself, because the container it
 *   ends up in cannot know what it is;
 * - a scroller between the pointer and the box with room left that way, which
 *   keeps the gesture until it has none;
 * - another box that travels, between the pointer and this one: the innermost
 *   one walks the axis it walks, and leaves the others whatever axis it does
 *   not (see axesLeftBy).
 */

import { createDragGestureController } from "./drag_gesture.js";
import { dragAfterIntent } from "./drag_after_intent.js";
import {
  claimWheelGesture,
  releaseWheelGesture,
  wheelGestureIsTakenFrom,
} from "../scroll/wheel_gesture.js";

// While a pointer is on something that travels: said on the document, because
// what has to be told is the document.
const GESTURE_ATTRIBUTE = "data-drag-travel-gesture";

// …and while one is actually travelling something, which is a later moment and
// takes more away (see the CSS).
const WALKING_ATTRIBUTE = "data-drag-travel-walking";

import.meta.css = /* css */ `
  :root[${GESTURE_ATTRIBUTE}] {
    /* The bounce the browser plays when a gesture reaches the end of a page —
       and the swipe that goes back in history with it. Both are the browser
       answering a gesture that is already answered, here, by what the finger is
       dragging: the page rocks under a travel that is doing its own moving, and
       one gesture is seen twice. From the press, because the browser starts
       answering from the press — waiting for the first pixel that travels would
       let it happen once, every time. Only while a finger is down, so a page
       that bounces the rest of the time goes on bouncing. */
    overscroll-behavior: none;
  }
  /* …and nothing inside a travelling box hands its leftovers to what is above
     it: a list that reaches its end passes what is left of the gesture up the
     chain, and the page moves behind a travel that is being dragged.

     Written ONCE AND FOR ALL rather than while a finger is down, unlike
     everything else here: a browser decides what a gesture may do when the
     gesture BEGINS — at the touchstart, at the first wheel event — and a
     property written after that decision arrives too late for the gesture it
     was meant for. That is what "most of the time it does not move, sometimes
     it does" is made of.

     On the axis the box travels on, and that one only: the other axis is the
     content's own scrolling and is left alone. Containing does not stop it from
     scrolling anyway — it stops it from spilling over.

     !important because this is not a preference: a box that travels cannot let
     the page travel with it, and the rule has to win over whatever an
     application says about its own scrollers.

     Said on the box, where it is a statement about the box and not about what
     it happens to hold — and read only where a browser asks the box at all:
     one that CLIPS is asked (it is a scroll container, which is what "asked"
     means to a browser), one that does not is walked past. A box that travels
     usually clips, because moving something in and out of a box is what
     clipping is for. One that does not still travels — what an inner scroller
     has left over reaches the page there, and the rule below says why that is
     the lesser of the two prices. An application that knows which of ITS
     elements scroll can contain those itself, on the element every engine
     reads; nothing in here can know that from a stylesheet. */
  [data-drag-travel*="x"] {
    overscroll-behavior-x: contain !important;
  }
  [data-drag-travel*="y"] {
    overscroll-behavior-y: contain !important;
  }
  /* The scrollers a browser makes on its own, wherever they are inside the box:
     a textarea and a list of options scroll their own content by nature, and
     nobody had to say so for them — no stylesheet declared them, so nothing
     else here can find them, and they would hand what is left of a gesture to
     the page like any undeclared scroller does.

     Named rather than found, because being native is exactly what makes them
     nameable. An input is NOT in the list: it is the one form control that has
     nothing to scroll on the axis anything travels on, and containing it is how
     a row-wide invisible checkbox becomes a hole under the wheel.

     A textarea with nothing in it, or a list of options short enough to fit, is
     contained too — a browser cannot be asked "only if it scrolls". On Blink
     that costs a wheel over an empty textarea, which then moves nothing rather
     than the list around it; elsewhere the engine already only asks what
     scrolls. Worth the page not moving behind a travel. */
  [data-drag-travel*="x"] :is(textarea, select[multiple], select[size]) {
    overscroll-behavior-x: contain !important;
  }
  [data-drag-travel*="y"] :is(textarea, select[multiple], select[size]) {
    overscroll-behavior-y: contain !important;
  }
  /* The same thing said again to everything inside — and only where saying it
     is what works.

     Two readings of "contain" are out there, and the rule above lands in only
     one of them. Blink walks EVERY scroll container between the pointer and the
     page and asks each one whether the gesture may go past it, whether or not
     it had anything to scroll: the box above is asked, and containing it is the
     whole answer. Gecko and WebKit ask only the ones that actually scroll: the
     box is skipped (it travels, it does not scroll), and what is left of a
     list's gesture reaches the page unless the LIST itself was told — which is
     what this does, to everything, because which descendant scrolls is not
     something a stylesheet can know.

     Not said to Blink, where it is not needed and does harm: an element that
     clips is a scroll container to a browser (a line of text with an ellipsis,
     a rounded card, an invisible checkbox covering a row), and Blink asking one
     of those with nothing to scroll gets "no further" for an answer — the wheel
     stops there and the list right above it never moves. A dead zone under the
     pointer, wherever something inside the box happens to clip.

     Blink is told apart by a property only it has, rather than by reading a user
     agent: the split above is between engines, and -webkit-app-region is one of
     the few things that names one. */
  @supports not (-webkit-app-region: none) {
    [data-drag-travel*="x"] * {
      overscroll-behavior-x: contain !important;
    }
    [data-drag-travel*="y"] * {
      overscroll-behavior-y: contain !important;
    }
  }
`;

// How far a pointer goes before it is a travel rather than a click: below this
// a press that wandered a pixel is still a press, and nothing budges.
const DRAG_START_THRESHOLD = 10;
// How much of a box has to be pulled for letting go to carry on rather than put
// things back, when the caller does not say. Under half, because a gesture that
// has clearly begun is an intention: asking for the box to be dragged all the
// way across turns a travel into work.
const DRAG_COMMIT_RATIO = 0.3;
// A flick travels whatever the distance: the hand said "away" quickly, which is
// the whole gesture — px/ms of pointer, and a few pixels to tell it from a tap
// that shook.
const DRAG_FLICK_VELOCITY = 0.4;
const DRAG_FLICK_DISTANCE = 8;
// Pulling towards nothing: what travels follows at a fraction of the finger, so
// the gesture is answered (something moves) while saying there is nothing that
// way. Let go and it comes back — a wall one can lean on, never walk through.
const DRAG_RESISTANCE = 0.3;

// What a drag must not start on: something that reads the pointer itself, whole,
// with no axis left to share. A button or a link is not in the list — dragging
// from one travels, and the click it would have made is swallowed on the way
// out. A drag SOURCE is not either: it says which way it goes and only takes
// that (see DRAG_SOURCE_AXES_ATTRIBUTE) — but a dedicated handle is, being a
// place whose only purpose is to be taken hold of, from the first pixel.
const DRAG_EXCLUDED_SELECTOR = [
  "input",
  "textarea",
  "select",
  '[contenteditable=""]',
  '[contenteditable="true"]',
  "[data-drag-handle]",
  "[data-no-drag-travel]",
].join(",");

// Which axes a box travels on, one attribute per gesture, said in the DOM by
// whoever owns the box: it is what a box ABOVE another reads to know the
// gesture is not its own, and the DOM is the only place where that is knowable
// from the outside.
const DRAG_AXES_ATTRIBUTE = "data-travel-by-drag";
const WHEEL_AXES_ATTRIBUTE = "data-travel-by-wheel";
// The same thing said by something that is PICKED UP rather than travelled: a
// row taken out of a list, a card carried across a board (see markDragSource).
// It holds the pointer from the press exactly as a nested travel does, so it is
// read exactly as one — a list reordered along its own line takes the axis it
// runs on and leaves the other to whoever is above.
const DRAG_SOURCE_AXES_ATTRIBUTE = "data-drag-source";

// A surface the browser paints in the top layer: it is still a DOM descendant
// of whatever it was written in, and it is nowhere near it on screen — it
// covers everything. So a gesture that happened on it is not the gesture of any
// box it merely sits on top of, and every walk up the tree from the pointer
// ends here: the boxes above are behind, and behind is not under the finger.
const TOP_LAYER_SELECTOR = [
  ":popover-open",
  "dialog:modal",
  ":fullscreen",
].join(",");
const isTopLayer = (element) => {
  return element.matches(TOP_LAYER_SELECTOR);
};

/**
 * What is left for this box of the axes it travels, once the boxes it CONTAINS
 * have taken theirs: a row of slides inside a page that walks between pages, a
 * carousel inside a carousel. Both get the same press (it bubbles), both answer
 * the same finger, and the one under it is the one the hand is pointing at — so
 * the innermost takes the axes it walks, and what it does not walk is left to
 * whoever is above: a row swiped sideways inside a column of screens keeps the
 * sideways gesture, and the column still answers a finger going down.
 *
 * Read at the press and nowhere else, because that is the only moment where the
 * order is still ours: from the first pixel the gesture is held by whoever asked
 * the browser for the pointer LAST, which is the outermost box — the wrong one,
 * and past that point the inner one stops being told anything. So the box that
 * does not own the gesture must never ask for it.
 *
 * A box lifted into the top layer on the way up takes everything: a popover or a
 * modal dialog is written inside a slide and painted over the whole screen, so
 * the slides are nowhere near the finger and none of the axes are left.
 */
const axesLeftBy = (axes, fromElement, stopElement, attribute) => {
  if (!stopElement.contains(fromElement)) {
    // Not a press that came up through this box: a browser view transition
    // delivers one to the document root instead, and the caller hands it over
    // by hand. Nothing was walked past, so nothing was taken.
    return axes;
  }
  let left = axes;
  let element = fromElement;
  while (element && element !== stopElement && element.nodeType === 1) {
    if (isTopLayer(element)) {
      // The gesture happened on a surface painted over this box, not in it:
      // there is nothing left of it here, whatever axes are still unclaimed.
      return "";
    }
    const taken = element.getAttribute(attribute);
    if (taken) {
      let rest = "";
      for (const axis of left) {
        if (!taken.includes(axis)) {
          rest += axis;
        }
      }
      left = rest;
      if (!left) {
        return "";
      }
    }
    element = element.parentElement;
  }
  return left;
};

/**
 * A scroller between the pointer and the box it is in, with room left the way
 * the gesture goes: it gets the gesture, and nothing travels — dragging a row
 * that scrolls sideways scrolls that row, and only a row with nowhere left to
 * go hands the travel over.
 */
export const scrollRoomTowards = (fromElement, stopElement, axis, sign) => {
  let element = fromElement;
  while (element && element !== stopElement && element.nodeType === 1) {
    if (isTopLayer(element)) {
      // A scroller above a top-layer surface is painted behind it: whatever
      // room it has left is not room the finger is asking for.
      return false;
    }
    const size = axis === "x" ? element.clientWidth : element.clientHeight;
    const scrollSize =
      axis === "x" ? element.scrollWidth : element.scrollHeight;
    if (scrollSize > size + 1) {
      const { overflowX, overflowY } = getComputedStyle(element);
      const overflow = axis === "x" ? overflowX : overflowY;
      if (overflow === "auto" || overflow === "scroll") {
        const position = axis === "x" ? element.scrollLeft : element.scrollTop;
        // Dragging the content one way reveals what is on the other side of
        // it: to the right means going back up the scroll.
        const room = sign > 0 ? position : scrollSize - size - position;
        if (room > 1) {
          return true;
        }
      }
    }
    element = element.parentElement;
  }
  return false;
};

// A gesture is over: does it carry on, or does everything go back? The distance
// pulled says it, and the speed says it too — a short flick means "away" as
// clearly as half a box does.
const travelsAfter = ({
  pulled,
  slack,
  size,
  velocity,
  towardsSomething,
  commitRatio,
}) => {
  if (!towardsSomething) {
    return false;
  }
  // Caught in flight and let go of again without a word: what was on its way
  // carries on. Answered on the distance alone, a travel a hand merely touched
  // is undone BY the touch — it was stopped where it stood, and where it stood
  // is not far enough to count as an intention. Nobody asked it to stop; it was
  // asked to wait.
  if (slack && Math.abs(pulled - slack) < DRAG_START_THRESHOLD) {
    return true;
  }
  const sign = pulled > 0 ? 1 : -1;
  const goingFast = Math.abs(velocity) > DRAG_FLICK_VELOCITY;
  // A hand that is still moving says where it is going, and it says it about
  // BOTH answers. Going away from what it was bringing in is "put it back",
  // whatever the distance already covered — which is the whole of what one asks
  // for when catching something in flight and throwing it back the other way.
  // Without this the picture alone decides, and a screen caught at two thirds
  // and thrown back still arrives: the gesture was read as the place it was let
  // go of rather than as a movement.
  if (goingFast && Math.sign(velocity) !== sign) {
    return false;
  }
  // …and going towards it travels whatever the distance: the hand said "away"
  // quickly, which is the whole gesture.
  const flicked = goingFast && Math.abs(pulled) > DRAG_FLICK_DISTANCE;
  return flicked || Math.abs(pulled) > size * commitRatio;
};

/**
 * Read a press, and tell the caller what the hand is doing with it.
 *
 * Called on pointerdown; returns a handle to stop the gesture, or null when the
 * press is not one this can be about (a right click, something that reads the
 * pointer itself).
 *
 * The gesture has no shape until the finger says which way it goes: `onStart`
 * is what turns a press into a travel, and it is asked at that moment rather
 * than when the finger landed, because whatever was moving then may have
 * arrived since.
 *
 * @param {PointerEvent} pointerDownEvent
 * @param {object} options
 * @param {Element} options.element - the box the gesture is about, and what the
 *   pointer is captured on: it outlives whatever the caller does about the
 *   travel, which the element under the finger may not.
 * @param {"x"|"y"|"xy"} [options.axes="xy"] - which ways this box can travel. A
 *   finger leaning on any other axis is given up on at once, whole, so whatever
 *   else wants it (a scroller, the page) gets it whole. An axis a box NESTED in
 *   this one travels is not one of them: it is that box's, and this call
 *   returns null when nothing is left (see axesLeftBy). Say so in the DOM with
 *   [data-travel-by-drag] for the boxes above to read.
 * @param {false|"x"|"y"} [options.immediate=false] - the axis this press is
 *   already on, for a press that landed on something moving: the gesture is
 *   then read from its first pixel instead of waiting for an intent, and every
 *   pixel since the grab is owed to the hand. The axis comes from the caller
 *   rather than from the movement, because there is nothing to decide — what
 *   was caught is travelling on one already.
 * @param {number} [options.commitRatio=0.3] - what fraction of the box has to
 *   be pulled for letting go to carry on rather than put things back. A
 *   fraction and never a distance, so the same gesture asks for the same thing
 *   on a phone and on a wide screen. Speed still answers on its own (see
 *   travelsAfter), whatever this says.
 * @param {(detail: {axis: string, sign: number, target: Element, event: PointerEvent}) => false|{size: number, slack?: number, travelBack?: boolean, travelOn?: boolean}} options.onStart
 *   - the finger has picked its axis. Answer `false` to give the gesture up, or
 *   with the geometry it walks: `size` (one box along that axis), `slack` (how
 *   far the box already sits from its resting place, for a travel grabbed
 *   mid-flight) and whether there is anywhere to go each way — `travelBack`
 *   towards the start of the axis, `travelOn` towards its end. A direction with
 *   nothing there is not refused, it resists.
 * @param {(detail: {axis: string, pulled: number, size: number, progress: number, event: PointerEvent}) => void} options.onPull
 *   - the finger has moved. `pulled` is in px from the resting place, `progress`
 *   the same as a fraction of the box, signed the same way.
 * @param {(detail: {axis: string, sign: number, event: PointerEvent}) => false|{size: number, travelBack?: boolean, travelOn?: boolean}} [options.onEdge]
 *   - the hand has reached an end of the box it holds and keeps going: `sign`
 *   says which one — the far edge, a box walked whole, or its start, a box
 *   walked back to where it began. Answer with the geometry of the box that
 *   lies that way to hand the gesture over to it: the pixels past the end
 *   become its first ones, so nothing is spent twice and the hand feels one
 *   continuous movement. Answer `false` (or leave it out) for a wall — the
 *   gesture stays on the box it has and leans on it.
 * @param {(detail: {axis: string, pulled: number, size: number, sign: number, travels: boolean, cancelled: boolean, event: PointerEvent}) => void} options.onEnd
 *   - the finger is off. `travels` is the gesture's answer: carry on to what was
 *   being pulled in, or put things back.
 * @param {() => void} [options.onGiveUp] - the press is over without ever
 *   becoming a travel: it stayed still, leaned the wrong way, or `onStart`
 *   refused it. Nothing was painted and nothing has to be put back — this is
 *   only so the caller can forget the gesture it is holding.
 */
export const startDragToTravel = (
  pointerDownEvent,
  {
    element,
    axes = "xy",
    immediate = false,
    commitRatio = DRAG_COMMIT_RATIO,
    onStart,
    onPull,
    onEnd,
    onEdge = () => false,
    onGiveUp = () => {},
  },
) => {
  const target = pointerDownEvent.target;
  if (!target.closest || target.closest(DRAG_EXCLUDED_SELECTOR)) {
    return null;
  }
  // A box between the finger and this one that travels the same way, and then
  // anything between them that is picked up and carried the same way: the
  // gesture is theirs, and this one is left with the axes none of them walks —
  // none at all, most of the time, and then there is no gesture here to read.
  const axesLeftByTravels = axesLeftBy(
    axes,
    target,
    element,
    DRAG_AXES_ATTRIBUTE,
  );
  const axesLeft =
    axesLeftByTravels &&
    axesLeftBy(axesLeftByTravels, target, element, DRAG_SOURCE_AXES_ATTRIBUTE);
  if (!axesLeft) {
    return null;
  }
  // What was caught in flight travels on an axis of its own, and it is not up
  // for decision: a box below has taken that axis, so what this press caught it
  // cannot carry on either.
  if (immediate && !axesLeft.includes(immediate)) {
    return null;
  }

  // The travel in hand: null until the finger has picked an axis and the caller
  // has accepted it.
  let travel = null;
  let dragGesture = null;
  let over = false;

  const finish = () => {
    if (over) {
      return;
    }
    over = true;
    document.documentElement.removeAttribute(GESTURE_ATTRIBUTE);
    document.documentElement.removeAttribute(WALKING_ATTRIBUTE);
    window.removeEventListener("pointerup", onPressOver);
    window.removeEventListener("pointercancel", onPressOver);
  };
  // A press that never became a travel: the intent never resolved, or the axis
  // it leaned on is not one this box walks. Nothing was painted and nothing has
  // to be put back — the caller is only told so it can forget the gesture.
  const onPressOver = (pointerEvent) => {
    if (pointerEvent.pointerId !== pointerDownEvent.pointerId || travel) {
      return;
    }
    finish();
    onGiveUp();
  };
  const giveUp = () => {
    finish();
    dragGesture?.release();
    onGiveUp();
  };

  // Where the picture stands, from what the gesture reports: the distance the
  // pointer has covered along the axis, less the pixels spent deciding — what
  // travels starts moving from where the finger is at that moment rather than
  // jumping the threshold it just crossed.
  // How far the POINTER has come along an axis. The raw distance, not the
  // layout the gesture computes for something being carried: nothing is being
  // carried here, and a scroll happening meanwhile must not read as a finger
  // that moved.
  const coveredOn = (axis, gestureInfo) =>
    axis === "x"
      ? gestureInfo.dragX - gestureInfo.grabX
      : gestureInfo.dragY - gestureInfo.grabY;
  const pullOf = (gestureInfo) => {
    const covered = coveredOn(travel.axis, gestureInfo);
    return travel.slack + (covered - travel.origin);
  };

  // Another box under the same hand, at either end of the one it holds. The
  // distance already covered on that side becomes the new box's own, measured
  // from where the finger IS: nothing is spent twice, and the gesture is one
  // movement rather than a wall the hand had to let go of to cross.
  // Returns where the new box stands, or null when there is nothing that way.
  const relayTo = (sign, distance, gestureInfo) => {
    const next = onEdge({
      axis: travel.axis,
      sign,
      event: gestureInfo.dragEvent,
    });
    if (!next || !next.size) {
      return null;
    }
    travel.size = next.size;
    travel.travelBack = Boolean(next.travelBack);
    travel.travelOn = Boolean(next.travelOn);
    travel.slack = 0;
    let pulled = distance;
    if (pulled > next.size) {
      pulled = next.size;
    } else if (pulled < -next.size) {
      pulled = -next.size;
    }
    travel.origin = coveredOn(travel.axis, gestureInfo) - pulled;
    return pulled;
  };

  const controller = createDragGestureController({
    // The threshold is left at its default and never crossed: what says this
    // press has become a gesture is the intent module below, which calls
    // start() itself. Zero here would mean "started from the grab", and a
    // gesture that starts on its own is never STARTED — the moment that
    // installs the click it must swallow and the touch it must refuse would
    // never come.
    // Nothing is being carried: the page keeps its focus, its scrolling and its
    // cursor while a screen slides under the finger. That is the whole
    // difference with a drag that moves an object, and it is one option.
    documentInteractions: "manual",
    onDragStart: () => {
      document.documentElement.setAttribute(GESTURE_ATTRIBUTE, "");
    },
    onDrag: (gestureInfo) => {
      // Releasing a gesture reports one last move, so giving one up would come
      // back through here and give it up again, forever.
      if (over) {
        return;
      }
      if (!travel) {
        let axis;
        if (immediate) {
          // The axis is not up for decision: what this press caught is already
          // travelling on one, and the caller said which. The first pixel of a
          // hand landing on something moving is a tremor as often as it is a
          // direction — read as a lean across the axis, it gives the gesture up
          // and lets go of what was caught, under a finger that has not asked
          // for anything yet.
          axis = immediate;
        } else {
          // ONE axis, decided by the first movement reported and never
          // revisited: a diagonal would ask for two travels at once and only
          // one thing can arrive.
          const reachX = Math.abs(coveredOn("x", gestureInfo));
          const reachY = Math.abs(coveredOn("y", gestureInfo));
          if (!reachX && !reachY) {
            return;
          }
          axis = reachX >= reachY ? "x" : "y";
          if (!axesLeft.includes(axis)) {
            giveUp();
            return;
          }
        }
        const covered = coveredOn(axis, gestureInfo);
        if (!covered) {
          // Nothing said on that axis yet: a grab without a movement, or one
          // straight across it. There is no gesture in that and nothing to give
          // up on either — whatever the caller caught at the press stays
          // caught, and the next report will say.
          if (immediate) {
            return;
          }
          giveUp();
          return;
        }
        const sign = Math.sign(covered);
        const started = onStart({
          axis,
          sign,
          target,
          event: gestureInfo.dragEvent,
        });
        if (!started || !started.size) {
          giveUp();
          return;
        }
        travel = {
          axis,
          size: started.size,
          travelBack: Boolean(started.travelBack),
          travelOn: Boolean(started.travelOn),
          slack: started.slack || 0,
          // The pixels spent deciding the axis are not pulled back — what
          // travels sets off from where the finger is at that moment rather
          // than jumping the threshold it just crossed. Except when the intent
          // was established before the press (see immediate): there was no
          // threshold to cross, so every pixel since the grab is the hand's and
          // is owed to it.
          origin: immediate ? 0 : covered,
          pulled: started.slack || 0,
        };
        document.documentElement.setAttribute(WALKING_ATTRIBUTE, axis);
        // The travel exists: from here the pointer is this box's, and it is
        // followed wherever it goes.
        dragGesture.capturePointer();
      }
      const { axis } = travel;
      let pulled = pullOf(gestureInfo);
      // Which side is being pulled in: dragging to the right brings in what is
      // on the left, which is what comes BEFORE.
      let towardsSomething = pulled > 0 ? travel.travelBack : travel.travelOn;
      // Past the start of the box in hand, and the caller has a box that way:
      // the hand is not leaning on a wall, it is walking into the next one
      // backwards. Asked before the resistance, so what it is handed is the
      // hand's own distance rather than a damped one.
      if (!towardsSomething && pulled) {
        const relayed = relayTo(pulled > 0 ? 1 : -1, pulled, gestureInfo);
        if (relayed !== null) {
          pulled = relayed;
          towardsSomething = true;
        }
      }
      let size = travel.size;
      if (!towardsSomething) {
        pulled *= DRAG_RESISTANCE;
      }
      if (pulled > size || pulled < -size) {
        const sign = pulled > 0 ? 1 : -1;
        // How far past the edge the hand has gone. Its own number, because it
        // is what the next box is owed if there is one.
        const overshoot = pulled - sign * size;
        pulled = sign * size;
        if (towardsSomething) {
          // A box walked whole, and the finger still going: the caller may have
          // another one to put under it. Then the gesture WALKS ON — the pixels
          // past the edge are its first ones, so the hand feels one movement
          // and not a wall it had to let go of to cross.
          const relayed = relayTo(sign, overshoot, gestureInfo);
          if (relayed === null) {
            // A box travels one box, and the hand can go further than that.
            // Those extra pixels are not owed back: the gesture is measured
            // from where the finger IS once it has reached the end, so turning
            // around moves the picture at once instead of first walking back
            // over the distance the hand went too far.
            travel.origin =
              coveredOn(axis, gestureInfo) - (pulled - travel.slack);
          } else {
            pulled = relayed;
            size = travel.size;
          }
        }
      }
      travel.pulled = pulled;
      onPull({
        axis,
        pulled,
        size,
        progress: pulled / size,
        event: gestureInfo.dragEvent,
      });
    },
    onRelease: (gestureInfo) => {
      if (over || !travel) {
        return;
      }
      finish();
      const { axis, size, pulled, slack } = travel;
      const towardsSomething = pulled > 0 ? travel.travelBack : travel.travelOn;
      const velocity =
        axis === "x" ? gestureInfo.velocityX : gestureInfo.velocityY;
      // A gesture taken away rather than let go of (the browser scrolling
      // something else, a call coming in, another gesture taking the pointer)
      // said nothing: things go back.
      const releaseEvent = gestureInfo.releaseEvent || gestureInfo.dragEvent;
      const { cancelled } = gestureInfo;
      onEnd({
        axis,
        pulled,
        size,
        sign: pulled > 0 ? 1 : -1,
        travels:
          !cancelled &&
          travelsAfter({
            pulled,
            slack,
            size,
            velocity,
            towardsSomething,
            commitRatio,
          }),
        cancelled,
        event: releaseEvent,
      });
    },
  });

  // When a press becomes a gesture, and by which rule. A travel is a swipe, so
  // the rule is the distance for EVERY pointer: the long press a finger is
  // asked for elsewhere says "pick this up and carry it", and asking for it
  // here would mean holding still before being allowed to swipe.
  const grab = () => {
    dragGesture = controller.grabViaPointer(pointerDownEvent, {
      element,
      // The box, not what the finger landed on: the caller's answer to this
      // gesture may take that away (a page that travels navigates, and the
      // router unmounts the page being left), and a capture whose element
      // leaves the document is a capture the browser drops.
      pointerCaptureElement: element,
      // A travel is established in two steps, and the pointer is only owned
      // after the second: the distance below says the press is not a click, and
      // the first move says which axis it leans on — which this box may not
      // walk, or the caller may refuse. Taken at the first step, the capture
      // would be taken away from whoever else is reading the same press for
      // gestures that give themselves up one event later. It is claimed once
      // the travel exists, in onDrag below.
      pointerCaptureDeferred: true,
    });
    return dragGesture;
  };
  if (immediate) {
    // Already in the gesture: what this press landed on was moving, and a hand
    // that reaches for something in motion has said what it wants by reaching.
    // Asking it to prove it over ten pixels is asking twice — and over those
    // pixels the thing it is holding answers to nobody.
    grab()?.start();
  } else {
    dragAfterIntent(pointerDownEvent, grab, {
      longPress: false,
      threshold: DRAG_START_THRESHOLD,
    });
  }
  window.addEventListener("pointerup", onPressOver);
  window.addEventListener("pointercancel", onPressOver);

  return {
    stop: () => {
      finish();
      dragGesture?.release();
    },
  };
};

// What each screen AFTER the first costs inside one gesture. Deliberately
// steep: reconstructing "how much did that flick mean" from a stream nobody
// agrees on is guesswork, and a guess that overshoots leaves someone three
// screens from where they were with no idea how they got there. Under-shooting
// costs one more push. So the door is open for a gesture that insists, and shut
// the rest of the time.
const WHEEL_NEXT_STEP_DELTA = 600;
// A stream that keeps getting weaker is momentum, not a hand: the system goes
// on sending long after the fingers are gone. Counted, one flick becomes five
// slides. Two events in a row are asked for rather than one, because a hand
// wavers and momentum does not.
const WHEEL_FADE_RUN = 2;

/**
 * A travel asked for with a wheel, and it asks for a WHOLE ONE.
 *
 * Two fingers swiping sideways on a trackpad, a mouse pushed sideways: the
 * browser sends `wheel` events and, left alone, answers them itself by
 * scrolling the page, bouncing it, or going back in history. Answering them
 * here is what stops that — a gesture is either ours or the browser's, and half
 * of each is what makes a page rock under a travel that is already moving.
 *
 * Read as STEPS and not as a distance, which is where this parts company with a
 * press: a hand on the box holds a screen and says where to put it, so it is
 * owed every pixel; a wheel points at the next screen and says "that one". What
 * travels is a row of slides, not a long strip one stops in the middle of, so
 * one push moves one slide — and the travel that follows plays at its own pace,
 * exactly as it would from a tab pressed or an arrow key.
 *
 * A gesture therefore moves ONE screen the moment it begins, on its first event
 * and whatever that event is worth: a hand that moved and saw nothing happen
 * does not wait, it pushes harder. Everything a threshold there would have
 * bought is bought instead by what the SECOND screen costs, which is a lot —
 * "how much did that flick mean" cannot be reconstructed from a stream nobody
 * agrees on, and a guess that overshoots leaves someone three screens away with
 * no idea how they got there. Under-shooting costs one more push, so that is
 * the side to be wrong on.
 *
 * A burst has no target either — every event lands on whatever is under the
 * pointer at that instant — so it is CLAIMED at its first event and answered to
 * the end wherever the pointer wanders (see wheel_gesture.js). Without that, a
 * hand pushing a nested carousel and drifting off it walks a slide, then walks
 * the box around it, on one push.
 *
 * The rest of the stream is mostly momentum, still arriving with the fingers
 * gone, and it must not be counted. What gives it away is that momentum only
 * ever WEAKENS: a stream that keeps shrinking is a push already answered, and a
 * number that grows again is a hand asking for more.
 *
 * @param {Element} element
 * @param {object} options
 * @param {"x"|"y"|"xy"} [options.axes="xy"] - which ways this box can travel.
 *   The other one is the content's own scrolling and is left alone, and an axis
 *   a box NESTED in this one travels is that box's (see axesLeftBy). Say so in
 *   the DOM with [data-travel-by-wheel] for the boxes above to read.
 * @param {(detail: {axis: string, sign: number, event: WheelEvent}) => void} options.onStep
 *   - one push, one screen. `sign` is positive towards the start of the axis,
 *   which brings in what comes BEFORE — a wheel says how far the CONTENT
 *   scrolls, and pushing content to the right reveals its left.
 * @returns {() => void} stop listening.
 */
export const watchWheelTravel = (element, { axes = "xy", onStep }) => {
  let gesture = null;

  const forgetGesture = () => {
    gesture = null;
    document.documentElement.removeAttribute(GESTURE_ATTRIBUTE);
    document.documentElement.removeAttribute(WALKING_ATTRIBUTE);
  };

  // Where the hand thinks it is pushing. Not "what the event landed on":
  // while a view transition is playing, the browser delivers the wheel to the
  // document root rather than to the box under the pointer, whatever the
  // pseudo-elements are told about pointer-events. Heard on the box alone, a
  // gesture that sets a travel off loses every event after the first — and the
  // page scrolls behind the travel with everything that was not taken.
  const isOverElement = (wheelEvent) => {
    const { target } = wheelEvent;
    if (element.contains(target)) {
      return true;
    }
    // Something the box is INSIDE, which is what a wheel lands on while a view
    // transition has taken the box's rendering away: the hit falls through to
    // the nearest ancestor still being painted. That is the only case worth
    // measuring for, and asking it this way round costs a walk up the tree
    // rather than a layout read — a page can hold many travelling boxes, and
    // every one of them would otherwise measure itself on every wheel event
    // anywhere.
    if (!target.contains(element)) {
      return false;
    }
    const { left, right, top, bottom } = element.getBoundingClientRect();
    const { clientX, clientY } = wheelEvent;
    return (
      clientX >= left && clientX <= right && clientY >= top && clientY <= bottom
    );
  };

  const onWheel = (wheelEvent) => {
    // The burst is already somebody else's — the box inside this one, a wheel
    // picker, whoever answered its first event. It is theirs to the end of it,
    // wherever the pointer has drifted since (see wheel_gesture.js).
    if (wheelGestureIsTakenFrom(element)) {
      return;
    }
    const axis =
      Math.abs(wheelEvent.deltaX) > Math.abs(wheelEvent.deltaY) ? "x" : "y";
    const delta = axis === "x" ? wheelEvent.deltaX : wheelEvent.deltaY;
    if (!delta) {
      return;
    }
    // Which way the screens go, said backwards: a wheel says how far the
    // CONTENT scrolls, and pushing content to the left brings in what is on the
    // right.
    const sign = delta > 0 ? -1 : 1;
    if (!gesture) {
      // Where the hand is pushing, asked at the START of a burst and never
      // again: from there on the gesture is this box's, and a pointer that has
      // wandered off it says nothing about what the hand is pushing.
      if (!isOverElement(wheelEvent)) {
        return;
      }
      if (!axes.includes(axis)) {
        // The other axis: the content's own scrolling, left whole to whatever
        // wants it.
        return;
      }
      // Who owns it, asked once for the gesture rather than for every event of
      // it — the same claims a press is read against (see the top of this
      // file), and all of them are answered by giving the gesture up whole:
      // nothing is prevented and the browser scrolls as it would have.
      const { target } = wheelEvent;
      if (
        (target.closest && target.closest(DRAG_EXCLUDED_SELECTOR)) ||
        scrollRoomTowards(target, element, axis, sign) ||
        // …plus the third: a box below this one that travels on this axis. Its
        // watcher hears the same wheel event this one does — they all listen at
        // the document — so without this both step, and one push moves two
        // things.
        !axesLeftBy(axis, target, element, WHEEL_AXES_ATTRIBUTE)
      ) {
        return;
      }
      gesture = {
        axis,
        sign,
        pushed: 0,
        lastMagnitude: 0,
        fadeRun: 0,
        stepped: false,
      };
      document.documentElement.setAttribute(GESTURE_ATTRIBUTE, "");
      document.documentElement.setAttribute(WALKING_ATTRIBUTE, axis);
    }
    // Ours from here, on both axes: what the browser would do with the leftover
    // — scroll the page behind the box, bounce it, go back in history — is one
    // gesture answered twice.
    wheelEvent.preventDefault();
    // …and said on every event of it, because a claim nobody renews is a
    // gesture that is over: silence is the only end a wheel has.
    claimWheelGesture(element, { onEnd: forgetGesture });
    if (axis !== gesture.axis) {
      // The other axis mid-gesture: a hand is never perfectly straight, and the
      // axis was decided when the gesture set off.
      return;
    }
    if (sign !== gesture.sign) {
      // Turned around: what was adding up was going the other way.
      gesture.sign = sign;
      gesture.pushed = 0;
      gesture.lastMagnitude = 0;
      gesture.fadeRun = 0;
      gesture.stepped = false;
    }
    if (!gesture.stepped) {
      // The first event of a gesture moves a screen, whatever it is worth —
      // a pixel is a hand that moved, and a hand that moved and saw nothing
      // happen pushes harder rather than waiting. Everything a threshold could
      // buy here is bought by what a screen AFTER this one costs.
      gesture.stepped = true;
      onStep({ axis: gesture.axis, sign: gesture.sign, event: wheelEvent });
      return;
    }
    const magnitude = Math.abs(delta);
    if (magnitude < gesture.lastMagnitude) {
      gesture.fadeRun += 1;
    } else if (magnitude > gesture.lastMagnitude) {
      // Back up again — a hand asking for more. Momentum never does this.
      gesture.fadeRun = 0;
    }
    gesture.lastMagnitude = magnitude;
    if (gesture.fadeRun >= WHEEL_FADE_RUN) {
      return;
    }
    gesture.pushed += magnitude;
    if (gesture.pushed < WHEEL_NEXT_STEP_DELTA) {
      return;
    }
    gesture.pushed = 0;
    onStep({ axis: gesture.axis, sign: gesture.sign, event: wheelEvent });
  };

  document.addEventListener("wheel", onWheel, {
    passive: false,
    capture: true,
  });
  return () => {
    document.removeEventListener("wheel", onWheel, { capture: true });
    // Handed back rather than left to lapse: a box that is gone must not hold a
    // gesture the boxes still there are asking about.
    releaseWheelGesture(element);
    forgetGesture();
  };
};
