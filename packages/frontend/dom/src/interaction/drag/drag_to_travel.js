/**
 * What a drag means when it TRAVELS: a whole box pushed aside by a hand, a popup
 * pushed back to close it, a row swiped away. What has somewhere to scroll to is a
 * scroller the browser moves, and is not here (navi's SlideContainer, RouteTravel).
 *
 * The pointer itself is not read here: reading a press, waiting for it to become
 * a gesture, capturing it, measuring how fast it goes, swallowing the click it
 * would have made is one gesture system for the whole codebase
 * (@jsenv/dom's drag_gesture + drag_after_intent), and this asks it for the
 * plain version — nothing carried, so no backdrop over the page, nothing made
 * inert, no focus taken: a screen slides and the page keeps its scrolling and
 * its keyboard, and its selection until the press has become a travel.
 *
 * What IS here is everything that makes a travel a travel rather than a
 * carry — and it is policy, not plumbing:
 * - the axis is LOCKED by the first movement, instead of being constrained
 *   ahead of time;
 * - a press becomes a gesture by distance for every pointer, finger included:
 *   a swipe is a travel, and asking a finger to hold still first (the rule for
 *   picking an object up) would mean waiting before being allowed to swipe;
 * - what travels walks ONE BOX, resists past its ends, and is measured from
 *   where the finger is once it gets there;
 * - letting go is a question with an answer: where the hand is about to put things.
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

import {
  collapseSelection,
  createDragGestureController,
} from "./drag_gesture.js";
import {
  AXIS_CROSS_DOMINANCE,
  dragAfterIntent,
  dragSourceThatStoodDown,
} from "./drag_after_intent.js";
import { canScroll, pageScrolls } from "../scroll/is_scrollable.js";

// While a pointer is on something that travels: said on the document, because
// what has to be told is the document. The selector below writes it out rather
// than reading this constant: a substitution in a selector is one the build
// cannot read, and it ships the whole stylesheet unparsed and uncompressed.
const GESTURE_ATTRIBUTE = "data-drag-travel-gesture";

// …and while one is actually travelling something, which is a later moment and
// takes more away (see the CSS).
const WALKING_ATTRIBUTE = "data-drag-travel-walking";

import.meta.css = /* css */ `
  :root[data-drag-travel-gesture] {
    /* The bounce the browser plays when a gesture reaches the end of a page —
       and the swipe that goes back in history with it. Both are the browser
       answering a gesture that is already answered, here, by what the finger is
       dragging: the page rocks under a travel that is doing its own moving, and
       one gesture is seen twice. Said once the press has become a gesture (the
       distance crossed) and
       taken back when it ends, so a page that bounces the rest of the time goes
       on bouncing. A browser decides this when the gesture begins, so said this
       late it is a last resort: the contain rules below are what do the work. */
    overscroll-behavior: none;
  }
  :root[data-drag-travel-walking] {
    /* A press on text is how one selects it, so the selection is left alone
       until the press has become a travel — and refused from then on, or the
       text the travel crosses turns blue. What its first pixels selected is
       collapsed at that same moment (see where the attribute is set). */
    user-select: none;
    -webkit-user-select: none;
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
     one that is a scroll container (overflow hidden, auto or scroll) is
     asked, one that is not is walked past. Overflow clip cuts without making
     one, so a box that clips that way is walked past like a box that does not
     clip at all. It still travels — what an inner scroller has left over
     reaches the page there, and the last rule below says why that is the
     lesser of the two prices. An application that knows which of ITS elements
     scroll can contain those itself, on the element every engine reads;
     nothing in here can know that from a stylesheet. */
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
     it had anything to scroll: a box above that is one is asked, and
     containing it is the whole answer. Gecko and WebKit ask only the ones that
     actually scroll: the box is skipped (it travels, it does not scroll), and
     what is left of a list's gesture reaches the page unless the LIST itself
     was told — which is what this does, to everything, because which
     descendant scrolls is not something a stylesheet can know.

     Not said to Blink, where it does harm: an element can be a scroll
     container with nothing to scroll (a line of text with an ellipsis, a
     rounded card cut with overflow hidden, an invisible checkbox covering a
     row), and Blink asking one of those gets "no further" for an answer — the
     wheel stops there and the list right above it never moves. A dead zone
     under the pointer, wherever something inside the box happens to be one.

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
// …and for a finger or a pen, which the browser pans with and has a deadline:
// ~8px in, it commits the touch to its own pan if that way is open to it (the
// axis touch-action leaves, or any axis over a scroller inside the box, which
// resets touch-action for what it holds). Chrome does it with the first
// touchmove it sends, held back until the touch leaves its slop; Safari with
// its pan recognizer. Refusing the touchmoves after that moment changes
// nothing — the pointer is cancelled and the swipe does nothing, or the travel
// already under way goes back. So the axis has to be read before it, with a
// margin: Safari does not wait for the answer to a report that jumps over its
// decision. The price is a tap that shook more than this: it is a swipe that
// went nowhere, and its click is lost (Chrome would click it up to 8px, Safari
// never once a touchmove is refused).
const DRAG_START_THRESHOLD_TOUCH = 6;
// Where the browser reads that same hand for itself, once and for good.
const BROWSER_PAN_READ_DISTANCE = 8;
// How much of a box a hand at rest has to have pulled for letting go to carry on
// rather than put things back, when the caller does not say. Half, as on every
// platform: the screen showing more is the one the hand put there.
const DRAG_COMMIT_RATIO = 0.5;
// Too little of a finger's way for its speed to mean anything, however fast: a
// tap that slipped. What Android's pagers ask of a fling (MIN_DISTANCE_FOR_FLING,
// 25dp).
const DRAG_FLICK_REACH = 25;
// Where a hand letting go is about to put things: this long at the speed it has
// at the lift. What UIScrollView's normal deceleration carries (Apple's
// "Designing Fluid Interfaces": v * rate / (1 - rate) at 0.998).
const DRAG_LANDING_MS = 500;
// Past this speed the hand has said where this goes whatever the box measures: a
// thumb flicks no faster on a tablet than on a phone, and half a wide box is out
// of reach of any landing. Android's pagers' bar (400dp/s), which is also about
// what a landing asks of a short flick on a phone.
const DRAG_FLICK_VELOCITY = 0.4;
// Pulling towards nothing: what travels follows at a fraction of the finger, so
// the gesture is answered (something moves) while saying there is nothing that
// way. Let go and it comes back — a wall one can lean on, never walk through.
const DRAG_RESISTANCE = 0.3;

// The gestures a browser ALREADY answers where a pointer goes down, named here
// rather than guessed at from a tag: what is native is the whole reason a travel
// must not start there. A caret dragged through text, a thumb pushed along its
// rail, a menu fed by everything that follows the press — taking the press from
// one of those takes away something the element cannot offer a second time, and
// a travel is never worth that.
//
// What is NOT in the list has nothing to lose. A button or a link is out on
// purpose: dragging from one travels, and the click it would have made is
// swallowed on the way out. So are the inputs that read the press and nothing
// after it (a checkbox, a radio, a colour, a file) — buttons by another name.
// Which matters more than it looks: a selectable row is covered by an invisible
// radio of its own, so excluding every input at once means a list of rows inside
// a travelling box that no finger can push.
//
// Every entry answers "never", and the entry is where a softer answer would be
// written if one turned out to be worth it — per hand, since that is where these
// gestures differ. The one that comes to mind is a travel a MOUSE could still
// ask for by holding still first, a hold meaning nothing to a mouse in a text
// field: it is not here because the browser has already begun a selection at the
// press, and nothing hands that back mid-gesture — the travel would drag a
// selection along with it. With a finger the hold is the selection UI itself, so
// there is nothing to take there either.
const PRESSED_INPUT_TYPES = [
  '[type="checkbox"]',
  '[type="radio"]',
  '[type="button"]',
  '[type="submit"]',
  '[type="reset"]',
  '[type="image"]',
  '[type="color"]',
  '[type="file"]',
].join(",");
const NATIVE_POINTER_GESTURES = [
  {
    // The value follows the pointer, pixel by pixel: a thumb along its rail, a
    // spinner clicked up and down. There is no moment in that which could be
    // given away — the gesture IS the pointer.
    selector: 'input[type="range"],input[type="number"]',
  },
  {
    // The text answers the pointer, and differently per hand: a mouse drags a
    // caret through it (a selection), a finger drags the field's own content
    // sideways when it overflows, and a finger held still opens the selection
    // UI. Three things a field is for, against one travel that has a whole box
    // to start from.
    selector: [
      `input:not(${PRESSED_INPUT_TYPES},[type="range"],[type="number"])`,
      "textarea",
      '[contenteditable=""]',
      '[contenteditable="true"]',
    ].join(","),
  },
  {
    // A menu opens under the pointer and the browser keeps the rest of the
    // gesture: dragged over, it picks an option.
    selector: "select",
  },
];

// …and what an element says against its own tag. Every line above is about what
// an element DOES, and a tag only says what it IS: a picker's façade is an
// <input> that opens a popup on the press and reads nothing at all as the
// pointer moves (it selects its own text on mousedown, and that is the whole of
// it). Only the element knows that, so only the element can say it — and having
// said it, it is a button by another name like the others, and a travel starts
// there like anywhere else.
//
// Said rather than found, and said on the element the pointer lands on: a
// promise about a gesture has to be readable before the gesture exists, from
// nothing but the DOM under the finger. And it is a promise: an element that
// says it while the browser still answers the pointer there (a range, a field
// that can really be typed in) has not made a travel possible, it has taken the
// gesture the user was making away from them.
const PRESS_ONLY_ATTRIBUTE = "data-press-only";
const NATIVE_POINTER_GESTURE_SELECTOR = NATIVE_POINTER_GESTURES.map(
  ({ selector }) => `:is(${selector}):not([${PRESS_ONLY_ATTRIBUTE}])`,
).join(",");

// What a drag must not start on: what answers the pointer natively (above),
// plus what has said the gesture is its own. A drag SOURCE is not in the list:
// it says which way it goes and only takes that (see DRAG_SOURCE_AXES_ATTRIBUTE)
// — but a dedicated handle is, being a place whose only purpose is to be taken
// hold of, from the first pixel. And so is an element naming `drag` among its
// own interactions: it said the grab is ITS, here, rather than the box's — and
// one that named only the click said nothing to this gesture and is passed
// through (see DRAG_IGNORED_SELECTOR in drag_to.js). And so is a popover or a
// dialog: a layer OVER the box, whose press only bubbles through the box because
// the layer is anchored in it.
export const DRAG_EXCLUDED_SELECTOR = [
  NATIVE_POINTER_GESTURE_SELECTOR,
  "[data-drag-handle]",
  "[data-no-drag-travel]",
  '[data-self-interactions~="drag"]',
  '[data-self-interactions~="*"]',
  "[popover]",
  // An idle PopupGroup is part of the page (see DRAG_IGNORED_SELECTOR).
  "dialog:not([navi-popup-group]:not(:modal))",
].join(",");

// Which axes a box travels on, one attribute per gesture, said in the DOM by
// whoever owns the box: it is what a box ABOVE another reads to know the
// gesture is not its own, and the DOM is the only place where that is knowable
// from the outside.
const DRAG_AXES_ATTRIBUTE = "data-travel-by-drag";
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
 *
 * `stoodDown` is the one element on the way up whose axes are not read: a drag
 * source that says this press carries nothing (see standDownFromPress in
 * drag_after_intent.js).
 */
const axesLeftBy = (axes, fromElement, stopElement, attribute, stoodDown) => {
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
    if (element === stoodDown) {
      // It says which way it would be dragged and it is not being dragged from
      // this press (standDownFromPress): a locked object walks no axis, so it
      // takes none — a swipe that starts on it is the swipe of whatever it
      // stands in.
      element = element.parentElement;
      continue;
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

// Whether something under the pointer scrolls on this axis, the page included.
// Room left is not asked: a thumb still flicking towards the end of a list is
// scrolling it, the same as anywhere else on that list.
const somethingScrollsOn = (fromElement, axis) => {
  let element = fromElement;
  while (element && element.nodeType === 1) {
    if (canScroll(element, axis)) {
      return true;
    }
    if (isTopLayer(element)) {
      // What scrolls behind a surface painted over it is not under the finger.
      return false;
    }
    element = element.parentElement;
  }
  return pageScrolls(fromElement.ownerDocument, axis);
};

// A gesture is over: does it carry on, or does everything go back? Where the
// hand is about to put things says it, with one question for every hand: thrown
// back, a screen caught at two thirds lands short and goes back; thrown on, a
// short flick lands far and goes; at rest, the picture is the only witness left.
const travelsAfter = ({
  pulled,
  reach,
  size,
  liftVelocity,
  towardsSomething,
  cancelled,
  commitRatio,
}) => {
  if (!towardsSomething) {
    return false;
  }
  // Taken away: things go back rather than landing wherever the hand happened to
  // be.
  if (cancelled) {
    return false;
  }
  const distance = Math.abs(pulled);
  const asked = size * commitRatio;
  if (reach <= DRAG_FLICK_REACH) {
    return distance > asked;
  }
  const sign = pulled > 0 ? 1 : -1;
  const speed = liftVelocity * sign;
  if (Math.abs(speed) > DRAG_FLICK_VELOCITY) {
    return speed > 0;
  }
  return distance + speed * DRAG_LANDING_MS > asked;
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
 * @param {number} [options.commitRatio=0.5] - what fraction of the box has to
 *   be pulled for letting go at rest to carry on rather than put things back. A
 *   fraction and never a distance, so the same gesture asks for the same thing
 *   on a phone and on a wide screen. A hand still moving is read by where it is
 *   about to land, against that same fraction (see travelsAfter).
 * @param {(detail: {axis: string, sign: number, target: Element, event: PointerEvent}) => false|{size: number, travelBack?: boolean, travelOn?: boolean}} options.onStart
 *   - the finger has picked its axis. Answer `false` to give the gesture up, or
 *   with the geometry it walks: `size` (one box along that axis) and whether
 *   there is anywhere to go each way, `travelBack` towards the start of the axis,
 *   `travelOn` towards its end. A direction with nothing there is not refused, it
 *   resists.
 * @param {(detail: {axis: string, pulled: number, size: number, progress: number, event: PointerEvent}) => void} options.onPull
 *   - the finger has moved. `pulled` is in px from the resting place, `progress`
 *   the same as a fraction of the box, signed the same way.
 * @param {(detail: {axis: string, pulled: number, size: number, sign: number, travels: boolean, cancelled: boolean, event: PointerEvent}) => void} options.onEnd
 *   - the finger is off. `travels` is the gesture's answer: carry on to what was
 *   being pulled in, or put things back. `sign` is the side `pulled` is on.
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
    commitRatio = DRAG_COMMIT_RATIO,
    onStart,
    onPull,
    onEnd,
    onGiveUp = () => {},
  },
) => {
  const target = pointerDownEvent.target;
  if (!target.closest || isPressExcluded(target, element)) {
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
    axesLeftBy(
      axesLeftByTravels,
      target,
      element,
      DRAG_SOURCE_AXES_ATTRIBUTE,
      dragSourceThatStoodDown(pointerDownEvent),
    );
  if (!axesLeft) {
    return null;
  }
  // A link and an image are draggable without anyone asking, and the browser
  // starts that drag about 3px in, under the threshold below: it cancels the
  // pointer and keeps the rest of the press, so the travel never forms. Refused
  // for this press only — one excluded above, or left to a box inside, keeps it.
  const refuseNativeDrag = (dragStartEvent) => {
    dragStartEvent.preventDefault();
  };
  element.addEventListener("dragstart", refuseNativeDrag);
  const startThreshold =
    pointerDownEvent.pointerType === "mouse"
      ? DRAG_START_THRESHOLD
      : DRAG_START_THRESHOLD_TOUCH;
  const crossAxis = axesLeft === "x" ? "y" : axesLeft === "y" ? "x" : null;
  // Whether this hand is the browser's: read as it reads it, onto something
  // that scrolls that way. A mouse scrolls with its wheel, so nothing disputes
  // its drag.
  const browserPansAcross = (reachX, reachY) => {
    const axisForTheBrowser = reachY >= reachX ? "y" : "x";
    return (
      axisForTheBrowser === crossAxis &&
      pointerDownEvent.pointerType !== "mouse" &&
      somethingScrollsOn(target, crossAxis)
    );
  };

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
    element.removeEventListener("dragstart", refuseNativeDrag);
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
  const pullOf = (gestureInfo) =>
    coveredOn(travel.axis, gestureInfo) - travel.origin;

  // What the hand says, read on every report of it: which axis, whether it has
  // become a travel, and where that travel stands.
  const readHand = (gestureInfo) => {
    if (!travel) {
      // ONE axis, decided by the first movement reported and never revisited: a
      // diagonal would ask for two travels at once and only one thing can arrive.
      //
      // The axis this box travels is favoured in that reading: a thumb swiping a
      // box sideways moves along an ARC, and its first reported pixels — which are
      // all this decision ever sees — lean off-axis far more than the gesture does.
      // Read even, that lean hands the whole gesture to an axis nobody meant (the
      // press is given up, and the hand's remaining hundred pixels are read by no
      // one). So the cross axis has to win CLEARLY to take the press.
      //
      // Unless a finger is on something that scrolls on that axis: somebody does
      // mean it there, and these few pixels wobble as much on a scroll as on a
      // swipe. The press is then read as the browser reads it, and no softer: past
      // that, the browser has dropped its pan for the whole touch, and a press
      // given up there belongs to nobody.
      let axis;
      const reachX = Math.abs(coveredOn("x", gestureInfo));
      const reachY = Math.abs(coveredOn("y", gestureInfo));
      if (!reachX && !reachY) {
        return;
      }
      if (crossAxis) {
        const along = crossAxis === "y" ? reachX : reachY;
        const cross = crossAxis === "y" ? reachY : reachX;
        const crossWins =
          cross > along * AXIS_CROSS_DOMINANCE ||
          browserPansAcross(reachX, reachY);
        axis = crossWins ? crossAxis : axesLeft;
      } else {
        axis = reachX >= reachY ? "x" : "y";
      }
      if (!axesLeft.includes(axis)) {
        giveUp();
        return;
      }
      const covered = coveredOn(axis, gestureInfo);
      if (!covered) {
        // Nothing said on that axis: a grab without a movement, or one straight
        // across it. There is no gesture in that.
        giveUp();
        return;
      }
      const sign = Math.sign(covered);
      const started = onStart({
        axis,
        sign,
        target,
        event: gestureInfo.dragEvent || pointerDownEvent,
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
        // Only what the intent threshold cost is withheld, so what travels does
        // not jump those few pixels at the start, and nothing more: a fast gesture
        // arrives coalesced, and the first report can carry most of a flick.
        // Charged whole, the flick would set off with nothing left of itself to
        // have pulled, move nothing on screen and be refused at the release for it.
        origin:
          covered > startThreshold
            ? startThreshold
            : covered < -startThreshold
              ? -startThreshold
              : covered,
        pulled: 0,
      };
      document.documentElement.setAttribute(WALKING_ATTRIBUTE, axis);
      // What the first pixels may have started selecting is not a selection:
      // it is the beginning of this travel.
      collapseSelection();
      // The travel exists: from here the pointer is this box's, and it is
      // followed wherever it goes.
      dragGesture.capturePointer();
    }
    const { axis, size } = travel;
    let pulled = pullOf(gestureInfo);
    // Which side is being pulled in: dragging to the right brings in what is on
    // the left, which is what comes BEFORE.
    const towardsSomething = pulled > 0 ? travel.travelBack : travel.travelOn;
    if (!towardsSomething) {
      pulled *= DRAG_RESISTANCE;
    }
    if (pulled > size || pulled < -size) {
      pulled = pulled > 0 ? size : -size;
      if (towardsSomething) {
        // A box travels one box, and the hand can go further than that. Those
        // extra pixels are not owed back: the gesture is measured from where the
        // finger IS once it has reached the end, so turning around moves the
        // picture at once instead of first walking back over the distance the
        // hand went too far.
        travel.origin = coveredOn(axis, gestureInfo) - pulled;
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
    // difference with a drag that moves an object.
    documentInteractions: "manual",
    // And a press on text is a selection until it has become a travel, which
    // is where the selection is refused (see where WALKING_ATTRIBUTE is set).
    selection: "manual",
    onDragStart: () => {
      document.documentElement.setAttribute(GESTURE_ATTRIBUTE, "");
    },
    onDrag: (gestureInfo) => {
      // Releasing a gesture reports one last move, so giving one up would come
      // back through here and give it up again, forever.
      if (over) {
        return;
      }
      readHand(gestureInfo);
    },
    onRelease: (gestureInfo) => {
      if (over || !travel) {
        return;
      }
      finish();
      const { axis, size, pulled } = travel;
      const towardsSomething = pulled > 0 ? travel.travelBack : travel.travelOn;
      const liftVelocity =
        axis === "x" ? gestureInfo.liftVelocityX : gestureInfo.liftVelocityY;
      const releaseEvent = gestureInfo.releaseEvent || gestureInfo.dragEvent;
      const { cancelled } = gestureInfo;
      onEnd({
        axis,
        pulled,
        size,
        sign: pulled > 0 ? 1 : -1,
        travels: travelsAfter({
          pulled,
          reach: Math.abs(coveredOn(axis, gestureInfo)),
          size,
          liftVelocity,
          towardsSomething,
          cancelled,
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
  // A press reading as the browser's pan is not given up before the browser has
  // read it: a thumb's arc can bend flat in those few pixels, the browser then
  // drops its pan, and a press already given up is nobody's. It goes on being
  // measured, with nothing refused, so both read the same report. One reading
  // as a travel takes the press at once: it needs the margin under the deadline.
  const grabOnceTheBrowserHasRead = (moveEvent) => {
    if (moveEvent) {
      const reachX = Math.abs(moveEvent.clientX - pointerDownEvent.clientX);
      const reachY = Math.abs(moveEvent.clientY - pointerDownEvent.clientY);
      if (
        Math.hypot(reachX, reachY) < BROWSER_PAN_READ_DISTANCE &&
        browserPansAcross(reachX, reachY)
      ) {
        dragAfterIntent(pointerDownEvent, grab, {
          longPress: false,
          threshold: BROWSER_PAN_READ_DISTANCE,
          selection: "manual",
        });
        return null;
      }
    }
    return grab();
  };
  dragAfterIntent(pointerDownEvent, grabOnceTheBrowserHasRead, {
    longPress: false,
    threshold: startThreshold,
    selection: "manual",
  });
  window.addEventListener("pointerup", onPressOver);
  window.addEventListener("pointercancel", onPressOver);

  return {
    stop: () => {
      finish();
      dragGesture?.release();
    },
  };
};

// The nearest word wins: what is excluded INSIDE the box takes the press away
// from it, what is around the box does not — a docked dialog IS the box that
// travels, and being a dialog is no reason for it to refuse its own press.
const isPressExcluded = (target, element) => {
  const excluded = target.closest(DRAG_EXCLUDED_SELECTOR);
  return Boolean(excluded) && !excluded.contains(element);
};

/**
 * Whether a press landing on `element` may become the gesture of something
 * around it — a box that travels by drag, an object carried out of a list. Or
 * of the element itself, when the element is that box: the gesture is still one
 * the press is being asked for.
 *
 * The question a control that acts ON THE PRESS has to ask before it acts: a
 * picker opening its popup at the pointerdown, the way a native select does,
 * is right only while nothing else disputes that press. Where a box above
 * travels, the finger going down is the beginning of something that is not yet
 * a choice — answering there both answers for a user who has chosen nothing and
 * takes the press from a gesture that could then never form. What such a control
 * does instead is wait for the click, which the browser only delivers if the
 * press stayed a press: a gesture swallows the one it leaves behind.
 *
 * Asked of the DOM at the press rather than worked out at render, because that
 * is where the answer lives: the box above says what it travels by
 * (DRAG_AXES_ATTRIBUTE, DRAG_SOURCE_AXES_ATTRIBUTE), and whether the press is
 * takeable at all is the same question the gesture itself asks a moment later —
 * a field the travel would never have started on disputes nothing, and a control
 * inside one goes on acting on the press.
 *
 * @param {Element} element Where the press landed.
 * @returns {boolean}
 */
export const isPressDisputedByDrag = (element) => {
  if (!element || typeof element.closest !== "function") {
    return false;
  }
  const dragged = element.closest(
    `[${DRAG_AXES_ATTRIBUTE}],[${DRAG_SOURCE_AXES_ATTRIBUTE}]`,
  );
  if (!dragged) {
    return false;
  }
  return !isPressExcluded(element, dragged);
};
