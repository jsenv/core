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
 * Who owns a gesture is decided in two places, and both are read here:
 * - what says so itself, with [data-no-drag-travel] or by being a field — a
 *   component that reads the pointer marks itself, because the container it
 *   ends up in cannot know what it is;
 * - a scroller between the pointer and the box with room left that way, which
 *   keeps the gesture until it has none.
 */

import { createDragGestureController, dragAfterIntent } from "@jsenv/dom";

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
     application says about its own scrollers. */
  [data-drag-travel*="x"],
  [data-drag-travel*="x"] * {
    overscroll-behavior-x: contain !important;
  }
  [data-drag-travel*="y"],
  [data-drag-travel*="y"] * {
    overscroll-behavior-y: contain !important;
  }
  :root[${WALKING_ATTRIBUTE}] {
    /* A drag over text selects it on the way, and the blue trail says the
       gesture was understood as something else. Not from the press: a press on
       text IS how one selects it, and only a press that has become a travel has
       said it was about something else. */
    user-select: none;
  }
`;

// How far a pointer goes before it is a travel rather than a click: below this
// a press that wandered a pixel is still a press, and nothing budges.
const DRAG_START_THRESHOLD = 10;
// How much of a box has to be pulled for letting go to carry on rather than put
// things back. Under half, because a gesture that has clearly begun is an
// intention: asking for the box to be dragged all the way across turns a travel
// into work.
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

// What a drag must not start on: something that reads the pointer itself. A
// button or a link is not in the list — dragging from one travels, and the
// click it would have made is swallowed on the way out.
const DRAG_EXCLUDED_SELECTOR = [
  "input",
  "textarea",
  "select",
  '[contenteditable=""]',
  '[contenteditable="true"]',
  "[data-no-drag-travel]",
].join(",");

/**
 * A scroller between the pointer and the box it is in, with room left the way
 * the gesture goes: it gets the gesture, and nothing travels — dragging a row
 * that scrolls sideways scrolls that row, and only a row with nowhere left to
 * go hands the travel over.
 */
export const scrollRoomTowards = (fromElement, stopElement, axis, sign) => {
  let element = fromElement;
  while (element && element !== stopElement && element.nodeType === 1) {
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
const travelsAfter = ({ pulled, size, velocity, towardsSomething }) => {
  if (!towardsSomething) {
    return false;
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
  return flicked || Math.abs(pulled) > size * DRAG_COMMIT_RATIO;
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
 *   else wants it (a scroller, the page) gets it whole.
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
 *   - a box has been walked whole and the finger is still going. Answer with the
 *   geometry of the next one to hand the gesture over to it — the pixels beyond
 *   the edge become its first ones, so nothing is spent twice and the hand feels
 *   one continuous movement. Answer `false` (or leave it out) for a wall: the
 *   gesture stays on the box it has, as it did before there was anything past
 *   it.
 * @param {(detail: {axis: string, pulled: number, size: number, sign: number, travels: boolean, cancelled: boolean, event: PointerEvent}) => void} options.onEnd
 *   - the finger is off. `travels` is the gesture's answer: carry on to what was
 *   being pulled in, or put things back.
 * @param {() => void} [options.onGiveUp] - the press is over without ever
 *   becoming a travel: it stayed still, leaned the wrong way, or `onStart`
 *   refused it. Nothing was painted and nothing has to be put back — this is
 *   only so the caller can forget the gesture it is holding.
 */
export const startDragTravel = (
  pointerDownEvent,
  {
    element,
    axes = "xy",
    immediate = false,
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
        // ONE axis, decided by the first movement reported and never
        // revisited: a diagonal would ask for two travels at once and only one
        // thing can arrive.
        const reachX = Math.abs(coveredOn("x", gestureInfo));
        const reachY = Math.abs(coveredOn("y", gestureInfo));
        if (!reachX && !reachY) {
          // Grabbed without the pointer having moved yet (see immediate): there
          // is no axis in a movement of nothing, and nothing to give up on
          // either — the next report will say.
          return;
        }
        const axis = reachX >= reachY ? "x" : "y";
        const covered = coveredOn(axis, gestureInfo);
        if (!axes.includes(axis) || !covered) {
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
      }
      const { axis } = travel;
      let size = travel.size;
      let pulled = pullOf(gestureInfo);
      // Which side is being pulled in: dragging to the right brings in what is
      // on the left, which is what comes BEFORE.
      const towardsSomething = pulled > 0 ? travel.travelBack : travel.travelOn;
      if (!towardsSomething) {
        pulled *= DRAG_RESISTANCE;
      }
      const beyondTheEnd = pulled > size || pulled < -size;
      if (beyondTheEnd) {
        const sign = pulled > 0 ? 1 : -1;
        // How far past the edge the hand has gone. Its own number, because it
        // is what the next box is owed if there is one.
        let overshoot = pulled - sign * size;
        pulled = sign * size;
        if (towardsSomething) {
          // A box walked whole, and the finger still going: the caller may have
          // another one to put under it. Then the gesture WALKS ON — the pixels
          // past the edge are its first ones, so the hand feels one movement
          // and not a wall it had to let go of to cross.
          const next = onEdge({ axis, sign, event: gestureInfo.dragEvent });
          if (next && next.size) {
            travel.size = size = next.size;
            travel.travelBack = Boolean(next.travelBack);
            travel.travelOn = Boolean(next.travelOn);
            travel.slack = 0;
            if (overshoot > size) {
              overshoot = size;
            } else if (overshoot < -size) {
              overshoot = -size;
            }
            pulled = overshoot;
          }
          // A box travels one box, and the hand can go further than that. Those
          // extra pixels are not owed back: the gesture is measured from where
          // the finger IS once it has reached the end, so turning around moves
          // the picture at once instead of first walking back over the distance
          // the hand went too far. Said for the new box as much as for the old
          // one — from here on the two are read the same way.
          travel.origin =
            coveredOn(axis, gestureInfo) - (pulled - travel.slack);
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
      const { axis, size, pulled } = travel;
      const towardsSomething = pulled > 0 ? travel.travelBack : travel.travelOn;
      const velocity =
        axis === "x" ? gestureInfo.velocityX : gestureInfo.velocityY;
      // A gesture taken away rather than let go of (the browser scrolling
      // something else, a call coming in) said nothing: things go back.
      const releaseEvent = gestureInfo.releaseEvent || gestureInfo.dragEvent;
      const cancelled = releaseEvent?.type === "pointercancel";
      onEnd({
        axis,
        pulled,
        size,
        sign: pulled > 0 ? 1 : -1,
        travels:
          !cancelled &&
          travelsAfter({ pulled, size, velocity, towardsSomething }),
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

// A trackpad gesture has no beginning and no end of its own: it is a stream of
// wheel events that starts when two fingers move and stops some time after they
// are lifted — the tail of it is the momentum the system keeps sending. So the
// end is read from silence.
// Long enough to survive a page that is busy: a trackpad sends an event every
// few milliseconds, but the frames right after a travel sets off are the ones
// where the main thread has the most to do (a navigation, a render, a picture
// to take), and a silence read as "the fingers are gone" there would cut ONE
// gesture into several travels.
const WHEEL_TRAVEL_END_DELAY = 150;
// Below this a wheel event is noise (a thumb resting, a mouse wheel's stray
// horizontal step) rather than someone pushing a page sideways.
const WHEEL_TRAVEL_START_DELTA = 2;

/**
 * The same travel, asked for with a trackpad.
 *
 * Two fingers swiping sideways is how one changes page on a laptop, and it is
 * not a drag at all: no press, no release, no pointer — the browser sends
 * `wheel` events and, left alone, answers them itself by bouncing the page or
 * going back in history. Answering them here is what stops that: a gesture is
 * either ours or the browser's, and half of each is what makes a page rock
 * under a travel that is already moving.
 *
 * Reads the same way as a press (`onStart`/`onPull`/`onEnd`, same numbers, same
 * answer at the end), so a caller drives one travel and not two.
 *
 * @param {Element} element
 * @param {object} options - as in startDragTravel, plus nothing.
 * @returns {() => void} stop listening.
 */
export const watchWheelTravel = (
  element,
  { axes = "xy", onStart, onPull, onEnd, onEdge = () => false },
) => {
  let travel = null;
  let endTimeout = null;

  const endTravel = () => {
    endTimeout = null;
    if (!travel) {
      return;
    }
    const { axis, size, pulled, velocity } = travel;
    const towardsSomething = pulled > 0 ? travel.travelBack : travel.travelOn;
    travel = null;
    document.documentElement.removeAttribute(GESTURE_ATTRIBUTE);
    document.documentElement.removeAttribute(WALKING_ATTRIBUTE);
    onEnd({
      axis,
      pulled,
      size,
      sign: pulled > 0 ? 1 : -1,
      travels: travelsAfter({ pulled, size, velocity, towardsSomething }),
      cancelled: false,
      event: null,
    });
  };

  const onWheel = (wheelEvent) => {
    const axis =
      Math.abs(wheelEvent.deltaX) > Math.abs(wheelEvent.deltaY) ? "x" : "y";
    const delta = axis === "x" ? wheelEvent.deltaX : wheelEvent.deltaY;
    if (!travel) {
      if (!axes.includes(axis) || Math.abs(delta) < WHEEL_TRAVEL_START_DELTA) {
        return;
      }
      // Which way the pages go, said backwards: a wheel says how far the
      // CONTENT scrolls, and pushing content to the left brings in what is on
      // the right.
      const sign = delta > 0 ? -1 : 1;
      const started = onStart({
        axis,
        sign,
        target: wheelEvent.target,
        event: wheelEvent,
      });
      if (!started || !started.size) {
        // Given up whole, so the browser still has it: nothing is prevented
        // below and the page scrolls as it would have.
        return;
      }
      travel = {
        axis,
        size: started.size,
        travelBack: Boolean(started.travelBack),
        travelOn: Boolean(started.travelOn),
        pulled: started.slack || 0,
        velocity: 0,
        lastTime: wheelEvent.timeStamp,
      };
      document.documentElement.setAttribute(GESTURE_ATTRIBUTE, "");
      document.documentElement.setAttribute(WALKING_ATTRIBUTE, axis);
    } else if (axis !== travel.axis) {
      // The other axis, mid-gesture: a trackpad is never perfectly straight and
      // the axis was decided when it set off (see startDragTravel).
      wheelEvent.preventDefault();
      return;
    }
    // Ours from here: whatever the browser would have done with it — bouncing
    // the page, going back in history — is the gesture answered twice.
    wheelEvent.preventDefault();
    let size = travel.size;
    let relayed = false;
    let pulled = travel.pulled - delta;
    const towardsSomething = pulled > 0 ? travel.travelBack : travel.travelOn;
    if (!towardsSomething) {
      pulled *= DRAG_RESISTANCE;
    }
    if (pulled > size || pulled < -size) {
      const sign = pulled > 0 ? 1 : -1;
      let overshoot = pulled - sign * size;
      pulled = sign * size;
      // The same relay as under a finger: a box walked whole hands the rest of
      // the gesture to the next one, and two fingers pushing steadily across
      // several pages are one gesture rather than a wall between each.
      if (towardsSomething) {
        const next = onEdge({ axis: travel.axis, sign, event: wheelEvent });
        if (next && next.size) {
          relayed = true;
          travel.size = size = next.size;
          travel.travelBack = Boolean(next.travelBack);
          travel.travelOn = Boolean(next.travelOn);
          if (overshoot > size) {
            overshoot = size;
          } else if (overshoot < -size) {
            overshoot = -size;
          }
          pulled = overshoot;
        }
      }
    }
    const elapsed = wheelEvent.timeStamp - travel.lastTime;
    if (elapsed > 0) {
      // How fast the fingers go, and they never stopped: read off the picture
      // as usual, but off the fingers themselves across a relay — the picture
      // starts the next box over at zero, and a jump backwards read as speed
      // would say the hand turned around at the very moment it did not.
      const instant = (relayed ? -delta : pulled - travel.pulled) / elapsed;
      travel.velocity = travel.velocity * 0.4 + instant * 0.6;
    }
    travel.pulled = pulled;
    travel.lastTime = wheelEvent.timeStamp;
    onPull({
      axis: travel.axis,
      pulled,
      size,
      progress: pulled / size,
      event: wheelEvent,
    });
    // The gesture is over when it goes quiet — there is nothing else to say so.
    clearTimeout(endTimeout);
    endTimeout = setTimeout(endTravel, WHEEL_TRAVEL_END_DELAY);
  };

  element.addEventListener("wheel", onWheel, { passive: false });
  return () => {
    element.removeEventListener("wheel", onWheel);
    clearTimeout(endTimeout);
    endTimeout = null;
    travel = null;
    document.documentElement.removeAttribute(GESTURE_ATTRIBUTE);
    document.documentElement.removeAttribute(WALKING_ATTRIBUTE);
  };
};
