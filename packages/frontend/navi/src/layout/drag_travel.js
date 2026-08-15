/**
 * The rules a pointer follows before what is under it travels.
 *
 * They are the same wherever a travel can be dragged — slides inside one box,
 * pages that are URLs — and they live here so ONE place says what the gesture
 * means: how far a press wanders before it is a gesture at all, which axis it
 * walks, what else has a better claim on it, and what letting go says. Two
 * copies of these numbers would be two gestures, and a hand cannot be asked to
 * learn them twice.
 *
 * What is NOT here is geometry: how big a box is, what lies one step that way,
 * what to paint while the finger moves. The caller knows those and nothing else
 * does — this reads the pointer and calls back.
 *
 * Who owns a gesture is decided in two places, and both are read here:
 * - what says so itself, with [data-no-drag-travel] or by being a field — a
 *   component that reads the pointer marks itself, because the container it
 *   ends up in cannot know what it is;
 * - a scroller between the pointer and the box with room left that way, which
 *   keeps the gesture until it has none.
 */

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
  const flicked =
    Math.abs(velocity) > DRAG_FLICK_VELOCITY &&
    Math.sign(velocity) === sign &&
    Math.abs(pulled) > DRAG_FLICK_DISTANCE;
  return flicked || Math.abs(pulled) > size * DRAG_COMMIT_RATIO;
};

/**
 * Read a press, and tell the caller what the hand is doing with it.
 *
 * Called on pointerdown; returns the gesture in hand, or null when the press is
 * not one this can be about (a second finger, a right click, something that
 * reads the pointer itself).
 *
 * The gesture has no shape until the finger says which way it goes: `onStart`
 * is what turns a press into a travel, and it is asked LAST — everything
 * positional is read at that moment rather than when the finger landed, because
 * whatever was moving then may have arrived since.
 *
 * @param {PointerEvent} pointerDownEvent
 * @param {object} options
 * @param {Element} options.element - where the moves are listened for and the
 *   pointer is captured: the box the gesture is about.
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
  { element, axes = "xy", onStart, onPull, onEnd, onGiveUp = () => {} },
) => {
  if (pointerDownEvent.button !== 0) {
    return null;
  }
  const target = pointerDownEvent.target;
  if (!target.closest || target.closest(DRAG_EXCLUDED_SELECTOR)) {
    return null;
  }

  const gesture = {
    pointerId: pointerDownEvent.pointerId,
    target,
    startX: pointerDownEvent.clientX,
    startY: pointerDownEvent.clientY,
    // Nothing but a press so far: the axis and the geometry it walks are read
    // the moment the finger says which way it is going.
    axis: null,
    size: 0,
    travelBack: false,
    travelOn: false,
    slack: 0,
    pulled: 0,
    velocity: 0,
    lastPosition: 0,
    lastTime: pointerDownEvent.timeStamp,
    stop: null,
  };

  const onMove = (pointerMoveEvent) => {
    if (pointerMoveEvent.pointerId !== gesture.pointerId) {
      return;
    }
    if (!gesture.axis) {
      const reachX = Math.abs(pointerMoveEvent.clientX - gesture.startX);
      const reachY = Math.abs(pointerMoveEvent.clientY - gesture.startY);
      if (reachX < DRAG_START_THRESHOLD && reachY < DRAG_START_THRESHOLD) {
        return;
      }
      // ONE axis, decided by the first few pixels and never revisited: a
      // diagonal gesture would ask for two travels at once and only one thing
      // can arrive — so the finger picks the axis it leans on, and the travel
      // walks that one alone.
      const axis = reachX >= reachY ? "x" : "y";
      if (!axes.includes(axis)) {
        gesture.stop();
        onGiveUp();
        return;
      }
      const sign =
        axis === "x"
          ? Math.sign(pointerMoveEvent.clientX - gesture.startX)
          : Math.sign(pointerMoveEvent.clientY - gesture.startY);
      const started = onStart({
        axis,
        sign,
        target: gesture.target,
        event: pointerMoveEvent,
      });
      if (!started || !started.size) {
        gesture.stop();
        onGiveUp();
        return;
      }
      gesture.axis = axis;
      gesture.size = started.size;
      gesture.travelBack = Boolean(started.travelBack);
      gesture.travelOn = Boolean(started.travelOn);
      gesture.slack = started.slack || 0;
      gesture.pulled = gesture.slack;
      // The pixels spent deciding are not pulled back: what travels starts
      // moving from where the finger is now, so it follows it exactly rather
      // than jumping the threshold it just crossed.
      gesture.startX = pointerMoveEvent.clientX;
      gesture.startY = pointerMoveEvent.clientY;
      gesture.lastPosition =
        axis === "x" ? pointerMoveEvent.clientX : pointerMoveEvent.clientY;
      gesture.lastTime = pointerMoveEvent.timeStamp;
      document.documentElement.setAttribute(WALKING_ATTRIBUTE, axis);
      // Every move from here on, wherever the finger wanders — off the box, off
      // the window — and the release with it.
      element.setPointerCapture(gesture.pointerId);
    }
    // The gesture is taken, and the browser is told so on every move: what it
    // would have done with it — panning the page, dragging the text under the
    // finger, starting a selection — is exactly what would be seen twice.
    if (pointerMoveEvent.cancelable) {
      pointerMoveEvent.preventDefault();
    }
    const { axis, size } = gesture;
    const moved =
      axis === "x"
        ? pointerMoveEvent.clientX - gesture.startX
        : pointerMoveEvent.clientY - gesture.startY;
    // Measured from where the gesture took over, never from what the move
    // before it painted: the resistance below would otherwise be applied again
    // to a value it has already shrunk, and a finger going nowhere would see
    // things creep back on their own.
    let pulled = gesture.slack + moved;
    // Which side is being pulled in: dragging to the right brings in what is on
    // the left, which is what comes BEFORE.
    const towardsSomething = pulled > 0 ? gesture.travelBack : gesture.travelOn;
    if (!towardsSomething) {
      pulled *= DRAG_RESISTANCE;
    }
    if (pulled > size) {
      pulled = size;
    } else if (pulled < -size) {
      pulled = -size;
    }
    gesture.pulled = pulled;
    onPull({
      axis,
      pulled,
      size,
      progress: pulled / size,
      event: pointerMoveEvent,
    });
    // How fast the hand is going, so that letting go says something a distance
    // cannot: a short flick travels, a long slow drag put back does not.
    const position =
      axis === "x" ? pointerMoveEvent.clientX : pointerMoveEvent.clientY;
    const elapsed = pointerMoveEvent.timeStamp - gesture.lastTime;
    if (elapsed > 0) {
      const instant = (position - gesture.lastPosition) / elapsed;
      gesture.velocity = gesture.velocity * 0.4 + instant * 0.6;
    }
    gesture.lastPosition = position;
    gesture.lastTime = pointerMoveEvent.timeStamp;
  };

  const onUp = (pointerEvent) => {
    if (pointerEvent.pointerId !== gesture.pointerId) {
      return;
    }
    gesture.stop();
    if (!gesture.axis) {
      // A press that never became a gesture: nothing was set up, nothing moved.
      onGiveUp();
      return;
    }
    // The click the browser makes of a press that travelled: swallowed, or
    // letting go over a button would press it. Capture, so it never reaches
    // what it landed on, and dropped right after in case none comes.
    const swallowClick = (clickEvent) => {
      clickEvent.stopPropagation();
      clickEvent.preventDefault();
    };
    document.addEventListener("click", swallowClick, { capture: true });
    setTimeout(() => {
      document.removeEventListener("click", swallowClick, { capture: true });
    });
    const { axis, size, pulled } = gesture;
    const sign = pulled > 0 ? 1 : -1;
    const towardsSomething = pulled > 0 ? gesture.travelBack : gesture.travelOn;
    // A hand that stopped before letting go has said "here", whatever it was
    // doing a moment earlier — so the speed only counts while it is still going.
    const velocity =
      pointerEvent.timeStamp - gesture.lastTime > 100 ? 0 : gesture.velocity;
    // A gesture taken away rather than let go of (the browser scrolling
    // something else, a call coming in) said nothing: things go back.
    const cancelled = pointerEvent.type === "pointercancel";
    const travels =
      !cancelled && travelsAfter({ pulled, size, velocity, towardsSomething });
    onEnd({
      axis,
      pulled,
      size,
      sign,
      travels,
      cancelled,
      event: pointerEvent,
    });
  };

  // The browser's own drag, which a mouse starts on a link or an image after a
  // few pixels: it would take the pointer away mid-gesture and leave everything
  // hanging.
  const preventNativeDrag = (dragStartEvent) => {
    dragStartEvent.preventDefault();
  };

  gesture.stop = () => {
    document.documentElement.removeAttribute(GESTURE_ATTRIBUTE);
    document.documentElement.removeAttribute(WALKING_ATTRIBUTE);
    element.removeEventListener("pointermove", onMove);
    element.removeEventListener("dragstart", preventNativeDrag);
    // On the window, not on the box: a pointer released outside it (or taken
    // away by the browser) must still end the gesture, or things would stay
    // where the finger left them.
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  };
  // Said from the press rather than from the first pixel that travels: the
  // browser answers a gesture from its very beginning (the page starts rocking
  // before anything of ours has moved), so waiting for the axis would let the
  // thing this prevents happen once, every time.
  document.documentElement.setAttribute(GESTURE_ATTRIBUTE, "");
  element.addEventListener("pointermove", onMove);
  element.addEventListener("dragstart", preventNativeDrag);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  return gesture;
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
  { axes = "xy", onStart, onPull, onEnd },
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
    const { size } = travel;
    let pulled = travel.pulled - delta;
    const towardsSomething = pulled > 0 ? travel.travelBack : travel.travelOn;
    if (!towardsSomething) {
      pulled *= DRAG_RESISTANCE;
    }
    if (pulled > size) {
      pulled = size;
    } else if (pulled < -size) {
      pulled = -size;
    }
    const elapsed = wheelEvent.timeStamp - travel.lastTime;
    if (elapsed > 0) {
      const instant = (pulled - travel.pulled) / elapsed;
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
