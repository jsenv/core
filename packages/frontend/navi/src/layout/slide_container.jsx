/**
 * Slides that replace one another inside one box.
 *
 * Every slide sits in the same grid cell, so the box measures itself on the
 * LARGEST of them and nothing resizes as one moves through them; a slide
 * travels by exactly one box, so a short one and a tall one move the same
 * distance.
 *
 * `layout` says where the slides are, and it takes either a word or a map:
 *
 *   <SlideContainer layout="row">        one after the other, in DOM order
 *   <SlideContainer layout="column">     the same, downwards
 *   <SlideContainer layout={["pick   edit",
 *                            "create"]}> a map of named areas
 *
 * The map is spelled the way CSS spells grid-template-areas: one string per
 * row, "." for a hole, a name repeated to span several cells. One place to read
 * the shape, drawn as it looks; a slide only says which area it is, so moving a
 * screen is an edit to the map and nothing else. There is no "grid" keyword,
 * because a grid without names says nothing — the map IS the grid. A word is
 * the map one would have drawn for a line, so it is drawn here and everything
 * below only ever knows about maps.
 *
 * A travel is ONE BOX long, whatever the distance between the two slides on the
 * map: the slide arriving is placed next to the one being left for the duration
 * and put back where the map says afterwards, so a tab bar jumping from the
 * first tab to the last shows those two and nothing else. Nobody wants to watch
 * the slides in between fly past — least of all in a tab bar, where they are
 * not a road one travels but places one goes straight to.
 *
 * A finger (or a mouse) drags the slides too: the track follows the pointer, the
 * neighbours are brought alongside for the occasion, and letting go either
 * carries on to the one being pulled in or puts the current one back — the
 * gesture decides, not the distance alone. It walks ONE AXIS, chosen from the
 * first few pixels: a diagonal would ask for two travels at once and only one
 * slide can arrive. What a gesture IS — how far it has to go, who else may
 * claim it, what letting go says — is read in drag_travel.js; what is here is
 * where the slides stand while it happens.
 *
 * The slides live INSIDE the box, which is what makes this work for a popup: a
 * dialog and a popover are both promoted to the browser's top layer, so no
 * container of ours could ever hold two of them side by side and translate the
 * pair. One popup holding slides of its own contents has no such problem — and
 * it is the same component in the document, in a dialog or in a popover.
 */

import {
  markAutofocusRestore,
  prepareFocusTransfer,
} from "../utils/focus/focus_transfer.js";
import { createContext } from "preact";
import {
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";
import { Box } from "../box/box.jsx";
import { scrollRoomTowards, startDragTravel } from "./drag_travel.js";
import { onNaviCommand } from "../control/commands.js";
import { useDebugFocus } from "../navi_debug.jsx";
import { Button } from "../control/input/button.jsx";
import {
  ChevronDownSvg,
  ChevronFirstSvg,
  ChevronLastSvg,
  ChevronLeftSvg,
  ChevronRightSvg,
  ChevronUpSvg,
} from "../graphic/icons/chevron_stroke_svg.jsx";
import { createOnKeyDownForShortcuts } from "../keyboard/keyboard_shortcuts.js";
import { Icon } from "../text/icon.jsx";

const css = /* css */ `
  /* Where the picture stands relative to the slide that is current, in boxes
     (see paintTravelProgress). Declared, so that it is a NUMBER the browser can
     interpolate: the trait an indicator draws has to travel with the slides,
     and an undeclared custom property only ever jumps from one value to the
     next. Inherited, so anything drawn inside the box can read it, and 0 by
     default — at rest there is nothing to lean towards. */
  @property --slide-travel-progress {
    syntax: "<number>";
    inherits: true;
    initial-value: 0;
  }

  /* Every slide in the same grid cell: the box then measures itself on the
     LARGEST of them, in both directions, without anything being measured by
     hand — which is also why nothing here resizes as the slides change. Each
     slide travels by exactly one box, so a short one and a tall one move the
     same distance. */
  .navi_slide_container {
    /* The ring of the slide holding the keyboard is drawn on the CONTAINER,
       not on the slide: a slide is deliberately square (its corners belong to
       this box, see [data-slide] below), so a ring drawn on one would come out
       square inside a rounded box and cut across the curve. Here it follows
       whatever radius this box was given.
       Not on the track either, for the other half of the reason: the track is
       what travels, and a ring riding along would slide out of the frame for
       the length of a travel. The two have the same geometry at rest, so
       nothing is lost by drawing it on the one that stays still.
       :has(), not a class set from JS: which slide is showing its focus is
       something the DOM already says. */
    position: relative;
    display: grid;
    min-width: 0;
    min-height: 0;
    /* Never bigger than what holds it: the box is as big as its largest slide,
       but a slide scrolls its own body, so the room it would need is not room
       it must be given. Shrinking is enough for that (the slides then scroll);
       GROWING is a decision the caller makes with expandY, for a box that must
       fill a container it does not need — see the dialog demo. */
    flex: 0 1 auto;
    /* Passed down rather than owned: this is usually the whole content of a
       rounded popup, and a slide (with its header) has to follow that curve —
       nothing between them may flatten it on the way. */
    border-radius: inherit;
    overflow: hidden;

    /* The browser's own ring, suppressed in favour of the one below: this box
       is focusable (see its tabIndex) and would otherwise get the UA outline
       drawn on top of ours, on its own terms. Same as the wheel does. */
    &:focus {
      outline: none;
    }

    /* What a touch may do here: the axis the slides travel on is taken (it is
       what the gesture drags), the other one is left to the page — so a
       carousel in an article is swiped sideways and the article still scrolls
       under the same finger. A map travelling both ways takes both.
       A scroller INSIDE a slide is not concerned: touch-action is read up to
       the scroll container the gesture would move, so a row that scrolls
       sideways within a slide still scrolls sideways. */
    &[data-travel-by-drag="x"] {
      touch-action: pan-y;
    }
    &[data-travel-by-drag="y"] {
      touch-action: pan-x;
    }
    &[data-travel-by-drag="xy"] {
      touch-action: none;
    }
    /* A drag is not a selection: without this a mouse pulling a slide paints
       the text it passes over blue. */
    &[data-slide-dragging] {
      user-select: none;
    }

    /* Outside the box, which is where an outline is drawn by default: nothing
       inside can paint over it (the slides are all within), and this box's own
       overflow does not clip it either — an element's outline is not its own
       overflow's business. So it needs no element of its own, unlike the
       wheel's ring, which marks a window inside the wheel. */
    &[data-focus-visible] {
      outline-width: var(--navi-focus-outline-width);
      /* A style of its own, not the shorthand, so whoever holds this box can
         take the ring over by setting the variable to "none" — the delegation
         offered by data-focus-outline-delegate. */
      outline-style: var(--navi-focus-outline-style, solid);
      outline-color: var(--navi-focus-outline-color);
      outline-offset: calc(-0.5 * var(--navi-focus-outline-width));
    }

    /* ONE thing moves: the track. The slides are laid out once and for all,
       each at its own place on the map, and never transition — so two
       neighbours cannot end up a pixel apart mid-travel the way two transitions
       running side by side can. It also means one transitionend, one duration,
       one easing, whatever the number of slides. */
    > [data-slide-track] {
      display: grid;
      min-width: 0;
      min-height: 0;
      grid-area: 1 / 1;
      border-radius: inherit;
      /* Where the track IS. Moving there is animated from JS (see the layout
         effect's own track.animate): a transition would have to be watched from
         the outside to know when it ends, and "when it ends" is what a looping
         container needs to be exact about. An animation is asked directly —
         it has a finished promise of its own. */
      translate: var(--slide-container-offset, 0);

      > [data-slide] {
        /* All in the one cell, so the box is as big as its largest slide and
           the others stretch to it (grid stretches by default) rather than
           floating in a corner of it. No display of its own here: a slide is a
           Box and keeps whatever it was given. */
        min-width: 0;
        min-height: 0;
        grid-area: 1 / 1;
        /* Square, deliberately: two rounded slides passing each other leave a
           pinched gap between their curves where the page shows through. The
           corners belong to the container, which clips them (overflow: hidden
           above) — so what one sees is rounded at rest and butt-jointed in
           motion, with nothing between two slides at any point of the travel. */
        border-radius: 0;
        /* Never on the slide: the ring is drawn on the container above, which
           is where the corners are. */
        outline: none;
        /* Its place on the map, in boxes — not a movement: same percentage
           reference as the track's own (both are the size of the box), so the
           distance the track travels is exactly the distance between two
           slides. */
        translate: var(--slide-offset, 0);
      }
      /* Off stage: everything but the slide one is looking at and, while the
         track moves, the slide one is leaving. A travel is one box long
         whatever the distance on the map (the two are placed a box apart for
         the occasion, see the layout effect), so the slides in between are
         never crossed — but on a map wider than one box they would still sit
         in the frame, and a tab bar jumping from the first tab to the last must
         show those two and nothing else.
         visibility, not display: this box is measured on its LARGEST slide, and
         a slide taken out of the layout would take its size out with it. */
      > [data-slide][data-slide-offstage] {
        visibility: hidden;
      }
      /* Nothing here for a slide not on screen: [inert] (set from JS) already
         takes it out of reach of the pointer, of Tab and of a screen reader —
         one attribute instead of pointer-events plus aria-hidden, and the only
         one the browser does not argue with about a focused descendant. */
    }
  }
`;

// How much of a travel is left to make, as a fraction of the travel that was
// asked for: 1 for a move starting from rest, less for one picked up while the
// track was already moving. Everything is measured in px against the track's
// own box, because that is what its percentages resolve to.
const ratioOfOneTravel = (track, from, to, targetBefore) => {
  const box = track.getBoundingClientRect();
  const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const target = offsetToPx(to, box);
  const asked = distance(offsetToPx(targetBefore, box), target);
  if (!asked) {
    return 1;
  }
  const left = distance(offsetToPx(from, box), target);
  const ratio = left / asked;
  return ratio > 1 ? 1 : ratio;
};

// A translate ("-100% 0%", "-260px 0px", "none") as two numbers of pixels.
// Percentages are the size of the box, which is what a translate resolves them
// against — so an offset written either way can be measured against another.
// Where the track stands right now, in pixels, read off the box it draws in
// rather than off the value that moves it: mid-animation the browser reports
// that value as a calc() of a percentage and a length ("calc(-43% - 119px)"),
// which no simple parse survives — read as 0, it puts the gesture a whole
// travel away from what the eye is looking at.
const trackOffsetPx = (track, containerElement) => {
  const trackRect = track.getBoundingClientRect();
  const containerRect = containerElement.getBoundingClientRect();
  return {
    x: trackRect.x - containerRect.x,
    y: trackRect.y - containerRect.y,
  };
};

const offsetToPx = (offset, box) => {
  if (!offset || offset === "none") {
    return { x: 0, y: 0 };
  }
  const [x = "0", y = "0"] = String(offset).trim().split(/\s+/);
  const toPx = (value, size) =>
    value.endsWith("%")
      ? (parseFloat(value) / 100) * size
      : parseFloat(value) || 0;
  return { x: toPx(x, box.width), y: toPx(y, box.height) };
};

// A press landing while the track is already travelling: what is playing is
// sent home in a fifth of the time it has left, and the press it could not take
// yet is taken as soon as it lands. A press has to be FELT — nudging the pace
// of a travel already in flight (what this used to do) reads as "nothing
// happened", because the thing was moving before the click too. Getting there
// almost at once and setting off again is the click being answered.
// Played out fast rather than cut short: ending it on the spot would jump.
// Compounds, so two presses during one travel bring it home twice as sharply,
// up to a rate past which nobody sees the difference anyway.
const HURRY_FACTOR = 5;
const HURRY_RATE_MAX = 25;
const hurryTravel = (animation) => {
  if (!animation || animation.playState !== "running") {
    return;
  }
  const rate = animation.playbackRate * HURRY_FACTOR;
  animation.playbackRate = rate > HURRY_RATE_MAX ? HURRY_RATE_MAX : rate;
};

// Which axes the map has anything on, read from the layout alone: it is what
// says which way a touch may travel, and a touch is answered before any of the
// DOM below has been looked at.
const dragAxesOf = (layout) => {
  if (typeof layout === "string") {
    return layout === "column" ? "y" : "x";
  }
  const { placeOf } = parseAreas(layout);
  let hasX = false;
  let hasY = false;
  for (const { x, y } of placeOf.values()) {
    if (x > 0) {
      hasX = true;
    }
    if (y > 0) {
      hasY = true;
    }
  }
  if (hasX && hasY) {
    return "xy";
  }
  return hasY ? "y" : "x";
};

// The ways out of a slide: whatever carries a travel command, the built-in
// chevrons (SlideNavButton) and anything a caller wired by hand alike. They are
// the container's chrome, not its content — see rememberFocus.
const WAY_OUT_SELECTOR = [
  '[command="--navi-left"]',
  '[command="--navi-right"]',
  '[command="--navi-up"]',
  '[command="--navi-down"]',
  '[command="--navi-back"]',
  '[command^="--navi-go-to-slide"]',
].join(",");
const isWayOut = (element) =>
  Boolean(element && element.closest && element.closest(WAY_OUT_SELECTOR));

// One object, shared: the areas nothing was ever handed to all read the same
// empty map, and a re-render changes nothing for them.
const EMPTY_VALUE_BY_AREA = {};

// What the container tells what is inside it: which way it travels, so a button
// can point the right way without being told twice.
const SlideContainerContext = createContext(null);
// What a slide tells what is inside IT: whether leaving it is allowed right
// now, so its own prev/next buttons say so instead of failing when pressed.
const SlideContext = createContext(null);
// What the travel into THIS slide carried (see SlideContainer's valueByArea).
const SlideValueContext = createContext(undefined);

/**
 * What the command that opened this slide was about: the `value` of whatever
 * asked for the travel — a button saying which entry it is editing
 * (`value={{ name }}` next to `command="--navi-right"`), a `--navi-down`
 * dispatched by hand with one.
 *
 * Undefined until something hands one over, and kept until the next travel into
 * the same slide hands over another: a screen opened again about something else
 * is about that something else.
 */
export const useSlideValue = () => useContext(SlideValueContext);

/**
 * The map, as cells: ["pick edit", "create"] becomes a lookup from a place to
 * the area sitting there, and from an area to the place it starts at. Written
 * once here so nothing else has to know how a map is spelled.
 */
const parseAreas = (areas) => {
  const rows = (Array.isArray(areas) ? areas : String(areas).split("\n"))
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => row.split(/\s+/));
  const areaAt = new Map();
  const placeOf = new Map();
  const order = [];
  let y = 0;
  for (const row of rows) {
    let x = 0;
    for (const name of row) {
      if (name !== ".") {
        areaAt.set(`${x},${y}`, name);
        // The first cell it appears in: an area spanning several cells is shown
        // from its top left corner, like a grid item is.
        if (!placeOf.has(name)) {
          placeOf.set(name, { x, y });
          order.push(name);
        }
      }
      x++;
    }
    y++;
  }
  return { areaAt, placeOf, order };
};

// A word is a map too: "row" is every slide on one line, "column" is one per
// line, both in the order they are written.
const lineAreas = (slideElements, layout) => {
  const names = slideElements.map(readArea);
  return parseAreas(layout === "column" ? names : [names.join(" ")]);
};

// A CSS duration read as a number, so a window knows when its travel is over.
const durationToMs = (duration) => {
  const number = parseFloat(duration);
  if (Number.isNaN(number)) {
    return 0;
  }
  return String(duration).trimEnd().endsWith("ms") ? number : number * 1000;
};

// What asked for a travel, read off the event that carried it: the hand said
// "somewhere over there" (a gesture one browses with), or it said a name (a tab
// pressed, a key, a command — a place aimed at). Nothing at all when the travel
// came from code, which has no interaction to speak of.
const causeOfEvent = (event) => {
  if (!event) {
    return "code";
  }
  const { type } = event;
  if (type === "pointerup" || type === "pointercancel") {
    return "drag";
  }
  if (type === "keydown" || type === "keyup") {
    return "keyboard";
  }
  return "command";
};

const readArea = (slideElement) =>
  slideElement.getAttribute("data-slide-area") || slideElement.id || "";

/**
 * The slide shown can be driven from outside (`current` + `onCurrentChange`) or
 * left to the container, which then answers the
 * --navi-left/--navi-right/--navi-up/--navi-down commands sent from anything
 * inside it.
 *
 * Which slides there are is read from the DOM, not from the children: a slide
 * is whatever <Slide> put there, wherever it came from — a fragment, a .map(),
 * a component of your own wrapping one. Nothing here assumes the children ARE
 * the slides, so nothing breaks when they are not.
 *
 * @param {object} props
 * @param {"row"|"column"|string[]} [props.layout="row"] - where the slides are.
 *   A word for a line — "row" to the right, "column" downwards, both in DOM
 *   order — or a map of named areas, one string per row: `["pick edit",
 *   "create"]`. Spelled like grid-template-areas ("." is a hole, a name
 *   repeated spans), except that a row needs no trailing hole: what is not
 *   written is simply not there.
 * @param {string} [props.current] - area (or id) of the slide being shown; omit
 *   to keep it here and drive it by command.
 * @param {string} [props.defaultCurrent] - which slide to open on, when the
 *   travel is left to the container. Mount-only, like every other `default*`:
 *   it says where one starts, not where one is — say `current` for that.
 *   Without it the first slide is the one shown, the way a stack of pages opens
 *   on its first page.
 * @param {(area: string, detail: {cause: "drag"|"keyboard"|"command"|"code", event: Event}) => void|false|Promise<void|false>} [props.onCurrentChange]
 *   - the slide being shown has changed. `cause` says what asked for it, which
 *   is what tells a place browsed past from a place aimed at: a caller writing
 *   this into the URL pushes a history entry for a tab that was pressed and
 *   replaces the current one for a slide that was dragged, so three swipes back
 *   and forth do not bury the way out of the page.
 *   Answer `false` to REFUSE the change and the slide goes back where it came
 *   from — a guard that says no, a session that is gone. A promise refuses it
 *   late, once whatever it had to ask has answered; the travel plays meanwhile
 *   and is undone if the answer is no.
 * @param {"now"|"rest"} [props.commit="now"] - when the change is told.
 *   "rest" waits for the travel to be over, and lets the container hold the
 *   slide it is going to meanwhile: the picture moves with the finger and the
 *   caller is told once, at the end. For a change that costs something or shows
 *   somewhere — the URL, a server — and cannot be asked for per frame.
 * @param {boolean} [props.loop] - the slides are a window over something
 *   endless (days, months, a carousel) rather than places one stays at. A
 *   travel plays as usual and then the window comes back to the slide it rests
 *   on, without a travel of its own — so the content is expected to have moved
 *   one step meanwhile, which is what `onLoop` is for. Travelling off one end
 *   comes back on the other, since a window has no end.
 * @param {(detail: {area: string, dx: number, dy: number, event: Event}) => void} [props.onLoop]
 *   - the window has rolled one step this way and is back at rest: move the
 *   content by one step, here, so the picture that lands in the middle is the
 *   one that just travelled there. Called once the travel is over, and in the
 *   same render as the return to rest — anything later shows the old content
 *   for a frame.
 * @param {boolean} [props.travelByKeyboard=true] - whether the arrows (and
 *   Home/End) walk the map. On by default: a map one can see is a map one
 *   expects to walk. Off when the arrows mean something else where these slides
 *   are — a list of choices one moves through, a picker whose screens are
 *   steps rather than places — so the keys keep the meaning the content gives
 *   them, and travelling stays something one asks for (a button, a command).
 * @param {boolean} [props.travelByDrag=true] - whether a pointer dragging the
 *   slides travels. On by default: slides side by side are something one
 *   expects to push around with a thumb. Off where the gesture belongs to the
 *   content (a canvas one draws on, a map one pans), or where the slides are
 *   steps of a form rather than a row one browses.
 * @param {string} [props.duration="300ms"] - how long a slide change takes.
 */
export const SlideContainer = ({
  layout = "row",
  current: currentProp,
  defaultCurrent,
  onCurrentChange,
  commit = "now",
  loop,
  onLoop,
  travelByKeyboard = true,
  travelByDrag = true,
  duration = "300ms",
  children,
  ...rest
}) => {
  import.meta.css = css;
  const debugFocus = useDebugFocus();
  const trackRef = useRef();
  // The box itself: it is what takes the keyboard when what is on screen holds
  // nothing that can (see handOverFocus).
  const containerRef = useRef();
  // The AREA of the slide being shown, not its rank: a rank would be wrong the
  // moment a slide appears before it, and there is nothing to renumber here.
  const [currentAreaState, setCurrentAreaState] = useState(defaultCurrent);
  // The slide this container is travelling to while its controller has not been
  // told yet (commit="rest"): for the length of that travel the container is
  // ahead of whoever holds `current`, and this is where it keeps its own answer
  // — dropped as soon as the controller has caught up, or the change was
  // refused.
  const [provisionalArea, setProvisionalArea] = useState(null);
  // The change waiting for the travel to be over: what to tell the caller, and
  // what to put back if they refuse it.
  const commitAtRestRef = useRef(null);
  // Where the window is while it rolls, and nothing more: a looping container
  // rests where it rested before (below), so this is the travel itself rather
  // than a change of slide.
  const [rollingArea, setRollingArea] = useState(null);
  // Nothing travels until something changes: the first paint is where the
  // slides ARE (a container opening on its third slide opens there, it does not
  // fly there), and the way back to rest is not a travel either — the content
  // has moved one step under the window, so the picture is already the right
  // one and the track has only to be where the resting slide is. Undone the
  // frame after, or the travel after that would jump too.
  const [noTravel, setNoTravel] = useState(true);
  const rollingRef = useRef(false);
  // The presses that arrived while the window was rolling: kept rather than
  // refused, and taken one per roll (see the effect below) — three quick
  // presses on a carousel are three steps, not one.
  const pendingRollsRef = useRef([]);
  // Where the track was left, so the next move knows what to travel FROM: an
  // animation is written as two ends, and reading the first one off the DOM
  // mid-travel would read a moving value.
  const offsetRef = useRef();
  const trackAnimationRef = useRef(null);
  // Where the slides are while the track moves, which is not where the map says
  // they are: the one being left stays put and the one arriving is placed ONE
  // BOX away from it, whichever way the travel goes and however far apart the
  // two are on the map. So a jump from the first tab to the last is one box of
  // travel and the tabs in between are never seen flying past — and everything
  // not in this map is off stage for the duration. Null at rest, when the map
  // is the whole truth again (see settleTravel).
  const stageRef = useRef(null);
  // Which slide the last drawing put on screen: the current one at rest, the
  // one being travelled TO while the track moves. What the next travel departs
  // from, because it is what one is looking at.
  const drawnAreaRef = useRef(undefined);
  // Which way the travel about to be drawn goes, when whatever asked for it
  // knows: a window stepping off its last slide comes back on its first, and
  // only the press says that is a step forward — the map, read between those
  // two places, says the opposite. Undefined for a travel asked for by name
  // (--navi-go-to-slide, --navi-back), where the map is the only thing that
  // knows and is right.
  const travelStepRef = useRef(null);
  // What to do once the travel now starting is over, handed to the animation as
  // soon as there is one.
  const rollBackRef = useRef(null);
  // A focus transfer read off the interaction that asked for the travel, kept
  // until the slide it is meant for holds its final DOM (see handOverFocus).
  const focusHandOverRef = useRef(null);
  // The gesture in hand, from the pointer that started it to the slides it
  // brought alongside. Null when no finger is on the box.
  const dragRef = useRef(null);
  // Where the travel about to be drawn departs from, when that is not where the
  // track rests: a slide let go of halfway carries on from under the finger.
  // Read and dropped by the layout effect, which is the one drawing it.
  const travelFromRef = useRef(null);
  // The same fact for the indicator (--slide-travel-progress): how far the
  // picture is from the slide ARRIVING when the travel starts, in boxes. Null
  // for a travel nobody dragged, where a whole box is what is left to close.
  const travelProgressFromRef = useRef(null);
  const progressAnimationRef = useRef(null);
  const current =
    rollingArea ?? provisionalArea ?? currentProp ?? currentAreaState;
  const vertical = layout === "column";
  const dragAxes = useMemo(
    () => (travelByDrag ? dragAxesOf(layout) : null),
    [travelByDrag, layout],
  );
  // Which required slides have been answered (see Slide's own `required`). Held
  // here rather than in each slide because answering one says something about
  // the others: the steps after it were answered about a state that has just
  // changed, so they stop counting as answered.
  const [answeredAreas, setAnsweredAreas] = useState([]);
  // What the last travel INTO an area carried, if anything: a button saying
  // which entry it is about (value={{ name }}) hands it to the slide it opens,
  // which reads it back with useSlideValue to fill a form with it. Per area,
  // because two ways in can mean two different things, and kept until the next
  // travel there replaces it.
  const [valueByArea, setValueByArea] = useState(EMPTY_VALUE_BY_AREA);
  // Where each area was reached FROM: what "back" means is a fact about the
  // travel, not about the map — a screen reached from two places goes back to
  // the one it was reached from, and no direction can say that. A ref, not
  // state: nothing on screen depends on it, and a travel must read what the
  // one before it wrote, not what the last render saw.
  const cameFromRef = useRef({});

  // The controller has caught up with the slide the container went to on its
  // own (commit="rest"): there are no longer two answers to give, so the
  // container gives its own up rather than holding a copy that can go stale.
  useLayoutEffect(() => {
    if (provisionalArea === null) {
      return;
    }
    const heldOutside = currentProp ?? currentAreaState;
    if (heldOutside === provisionalArea) {
      setProvisionalArea(null);
    }
  }, [provisionalArea, currentProp, currentAreaState]);

  // The travel is given back as soon as the picture it must not animate has
  // been painted: one frame with it off is all it takes.
  useLayoutEffect(() => {
    if (!noTravel) {
      return undefined;
    }
    const frame = requestAnimationFrame(() => {
      setNoTravel(false);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [noTravel]);

  // What the user was doing on each slide, so coming back comes back to it. The
  // ways out are left out on purpose: pressing one is how one LEAVES a slide,
  // and remembering it would mean coming back to the exit rather than to the
  // work — press →, press ←, and the keyboard would sit on the chevron one
  // pressed instead of on the field one was filling. They are chrome, like a
  // browser's own back button, which never becomes what the page restores.
  const focusMemoryRef = useRef(new WeakMap());
  useLayoutEffect(() => {
    const containerEl = containerRef.current;
    const onFocusIn = (focusInEvent) => {
      const focusedElement = focusInEvent.target;
      if (isWayOut(focusedElement)) {
        return;
      }
      const slideElement = focusedElement.closest?.("[data-slide]");
      if (slideElement && containerEl.contains(slideElement)) {
        focusMemoryRef.current.set(slideElement, focusedElement);
      }
    };
    containerEl.addEventListener("focusin", onFocusIn);
    return () => {
      containerEl.removeEventListener("focusin", onFocusIn);
    };
  }, []);
  // Written down at the moment a slide is left: what is focused now when that
  // is content, what was focused before otherwise, and nothing at all when the
  // slide never held the keyboard anywhere but on its own ways out — the slide
  // arriving then falls back to its ladder, which lands on what there is to do
  // (findFocusTarget, and the chevrons' own "last-resort").
  const rememberFocus = (slideElement, focusedElement) => {
    if (focusedElement && !isWayOut(focusedElement)) {
      markAutofocusRestore(slideElement, focusedElement);
      return;
    }
    const remembered = focusMemoryRef.current.get(slideElement);
    markAutofocusRestore(
      slideElement,
      remembered && slideElement.contains(remembered) ? remembered : null,
    );
  };

  const readMap = () => {
    const slideElements = Array.from(trackRef.current.children);
    const map =
      typeof layout === "string"
        ? lineAreas(slideElements, layout)
        : parseAreas(layout);
    return { slideElements, ...map };
  };

  const markAnswered = (area) => {
    const order = readMap().slideElements.map(readArea);
    const rank = order.indexOf(area);
    setAnsweredAreas((previous) => [
      ...previous.filter((answered) => order.indexOf(answered) < rank),
      area,
    ]);
  };

  // A slide reporting that what it was there for is done (see Slide's own
  // onnavi_done). Onwards, or back to where it came from when there is nothing
  // after it — a step that has been answered is not a step to stay on.
  const done = (area, event) => {
    markAnswered(area);
    if (!moveNext(event)) {
      movePrevious(event);
    }
  };

  // The travel is over: the stage is struck and every slide goes back where the
  // map says it is. Nothing is seen moving for it — the slide on screen sits at
  // the same place whatever the arrangement (its own offset and the track's are
  // opposites and cancel out), and the others are off stage — as long as the
  // two are written in one go, which is why this is done here rather than left
  // to a render.
  const settleTravel = () => {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    const { slideElements, placeOf } = readMap();
    const currentElement = slideElements.find((slideElement) =>
      slideElement.hasAttribute("data-current"),
    );
    if (!currentElement) {
      return;
    }
    stageRef.current = null;
    trackAnimationRef.current = null;
    // At rest the picture IS the current slide, whatever the last gesture wrote
    // there: an indicator has nothing left to lean towards.
    paintTravelProgress(0);
    for (const slideElement of slideElements) {
      const { x, y } = placeOf.get(readArea(slideElement)) || { x: 0, y: 0 };
      slideElement.style.setProperty(
        "--slide-offset",
        `${x * 100}% ${y * 100}%`,
      );
      slideElement.toggleAttribute(
        "data-slide-offstage",
        slideElement !== currentElement,
      );
    }
    const currentArea = readArea(currentElement);
    drawnAreaRef.current = currentArea;
    const { x, y } = placeOf.get(currentArea) || { x: 0, y: 0 };
    const offset = `${-x * 100}% ${-y * 100}%`;
    offsetRef.current = offset;
    track.style.setProperty("--slide-container-offset", offset);
    // Arrived, so the change can be told (commit="rest"): the picture is at
    // rest and whatever the caller does with it — write the URL, ask a server —
    // costs the gesture nothing anymore.
    const commitAtRest = commitAtRestRef.current;
    if (commitAtRest && commitAtRest.area === currentArea) {
      commitAtRestRef.current = null;
      answerCurrentChange(
        onCurrentChange(commitAtRest.area, {
          cause: commitAtRest.cause,
          event: commitAtRest.event,
        }),
        commitAtRest.leftArea,
      );
    }
  };

  // Everything positional is decided here, from the DOM, once per render: where
  // each slide stands on the map, which one is current, and how far the track
  // must be for that one to be the one on screen. Reading the DOM is what makes
  // the children free — their shape says nothing about the arrangement, the map
  // does — and it is also the only place that has to agree with itself.
  useLayoutEffect(() => {
    const { slideElements, placeOf } = readMap();
    if (slideElements.length === 0) {
      return;
    }
    const currentElement =
      slideElements.find(
        (slideElement) => readArea(slideElement) === current,
      ) ||
      // Nothing named, or a name nothing answers to: the first slide is the one
      // shown, the way a stack of pages opens on its first page.
      slideElements[0];
    const currentArea = readArea(currentElement);
    const realPlaceOf = (area) => placeOf.get(area) || { x: 0, y: 0 };
    const durationMs = durationToMs(duration);
    // Nothing is travelling, so nothing is staged: the picture to paint is the
    // map itself, and a stage left over from a travel that has just been given
    // up on would be painted instead of it.
    if (noTravel) {
      stageRef.current = null;
    }
    let stage = stageRef.current;
    // Which way this travel goes, kept for the indicator: a whole box lies
    // between the picture and the slide arriving, on the axis it walks.
    let travelStep = null;
    const drawnArea = stage ? stage.area : drawnAreaRef.current;
    const travelStarts =
      !noTravel &&
      durationMs > 0 &&
      drawnArea !== undefined &&
      drawnArea !== currentArea &&
      slideElements.some(
        (slideElement) => readArea(slideElement) === drawnArea,
      );
    if (travelStarts) {
      // Where the slide being left IS — the place the stage gave it if a travel
      // was already playing (a press landing mid-travel departs from where the
      // eye is, not from the map), its own place otherwise.
      const departurePlace = stage
        ? (stage.placeByArea.get(drawnArea) ?? realPlaceOf(drawnArea))
        : realPlaceOf(drawnArea);
      const step = travelStepRef.current || {
        x: Math.sign(realPlaceOf(currentArea).x - realPlaceOf(drawnArea).x),
        y: Math.sign(realPlaceOf(currentArea).y - realPlaceOf(drawnArea).y),
      };
      travelStep = step;
      // Kept, not replaced: the slides a chain of quick presses has already
      // left behind are still trailing off screen, and taking them off stage
      // now would blink them out mid-travel.
      const placeByArea = new Map(stage?.placeByArea);
      placeByArea.set(drawnArea, departurePlace);
      const arrivalPlace = {
        x: departurePlace.x + step.x,
        y: departurePlace.y + step.y,
      };
      // The cell the arriving slide takes, taken back from whoever was left
      // standing on it: a travel turned around mid-flight comes back over
      // ground it has just covered, and the slide it left there would be
      // underneath the one arriving — two pictures in one box.
      for (const [stagedArea, stagedPlace] of placeByArea) {
        if (
          stagedArea !== drawnArea &&
          stagedArea !== currentArea &&
          stagedPlace.x === arrivalPlace.x &&
          stagedPlace.y === arrivalPlace.y
        ) {
          placeByArea.delete(stagedArea);
        }
      }
      placeByArea.set(currentArea, arrivalPlace);
      stage = stageRef.current = { placeByArea, area: currentArea };
    }
    // Said about the travel now being drawn and about no other: a re-render in
    // the middle of one reads the stage back, which already knows.
    travelStepRef.current = null;
    const placeOfArea = (area) =>
      (stage && stage.placeByArea.get(area)) || realPlaceOf(area);
    const currentPlace = placeOfArea(currentArea);
    // A transfer waiting for a travel that never happened — a controlled
    // `current` the caller chose not to move: dropped, the focus has no
    // business going anywhere. The one for a travel that DID happen stays,
    // and lands when the slide it is for says it is settled (see settleFocus).
    if (
      focusHandOverRef.current &&
      focusHandOverRef.current.area !== readArea(currentElement)
    ) {
      focusHandOverRef.current = null;
    }
    // Read before anything is marked: setting inert below moves the focus out by
    // itself, so afterwards there is no way to tell whether it was inside. What
    // this is for is the travel nobody asked for — a `current` prop moved from
    // outside, with the keyboard still on the slide about to go out of reach. A
    // travel someone asked for has its own transfer waiting (focusHandOverRef),
    // and that one knows what was pressed.
    const focusIsLeaving =
      !focusHandOverRef.current &&
      slideElements.some(
        (slideElement) =>
          slideElement !== currentElement &&
          slideElement.contains(document.activeElement),
      );
    for (const slideElement of slideElements) {
      const area = readArea(slideElement);
      const { x, y } = placeOfArea(area);
      slideElement.style.setProperty(
        "--slide-offset",
        `${x * 100}% ${y * 100}%`,
      );
      const isCurrent = slideElement === currentElement;
      slideElement.toggleAttribute("data-current", isCurrent);
      slideElement.toggleAttribute("data-slide-displaced", !isCurrent);
      // On stage: the two ends of the travel while there is one, and the slide
      // being shown when there is not.
      slideElement.toggleAttribute(
        "data-slide-offstage",
        stage ? !stage.placeByArea.has(area) : !isCurrent,
      );
      if (isCurrent) {
        // Reachable again first, so the focus below has somewhere to land: an
        // inert element cannot take it.
        slideElement.removeAttribute("inert");
      }
    }
    const track = trackRef.current;
    const offset = `${-currentPlace.x * 100}% ${-currentPlace.y * 100}%`;
    // Where the track IS, read before anything is written: a travel asked for
    // while another is still playing must carry on from what is on screen. The
    // previous TARGET is where the last travel was going, not where it got to —
    // starting from it would jump the track to the end of a move that never
    // finished, and only then slide back.
    // Read, rather than left implicit: an animation with only a "to" keyframe
    // starts from the UNDERLYING value, which is the resting offset (the CSS
    // var just below) and not the moving one — the animation being replaced
    // does not contribute to it. So the position on screen is a thing to go and
    // fetch, and having it in hand is also what allows the pace below.
    const travelInFlight = trackAnimationRef.current?.playState === "running";
    const offsetOnScreen = travelInFlight
      ? getComputedStyle(track).translate
      : undefined;
    // …and where a slide let go of halfway was left, which is the same fact
    // said by the gesture that put it there: the track is at rest as far as any
    // animation is concerned, so nothing else could tell.
    const offsetDragged = travelFromRef.current;
    travelFromRef.current = null;
    const offsetBefore = offsetDragged ?? offsetOnScreen ?? offsetRef.current;
    // The travel that was ASKED for is still one box, whatever is left of it to
    // cover: a slide dragged most of the way there finishes in what is left of
    // the duration rather than taking a full one over a few pixels.
    const offsetTargetBefore = offsetRef.current;
    offsetRef.current = offset;
    // Where the track ends up, always — the animation below only covers the way
    // there, and when it is over this is what holds.
    track.style.setProperty("--slide-container-offset", offset);
    const travels =
      !noTravel &&
      durationMs > 0 &&
      offsetBefore !== undefined &&
      offsetBefore !== offset;
    if (travels) {
      // The time it takes is the distance it has left to cover: a travel picked
      // up a fifth of the way through goes back in a fifth of the time, so what
      // one sees keeps the speed it already had instead of crawling back over a
      // short distance for a full duration. One box in `duration` is the pace;
      // this only ever shortens it (a longer travel is not made slower, which
      // would make a two-box move drag).
      const travelRatio = ratioOfOneTravel(
        track,
        offsetBefore,
        offset,
        offsetTargetBefore,
      );
      // Already moving — under an animation or under a finger that has just
      // let go — so there is no ease-in to play: it would stall the track for
      // an instant right where the eye is following it.
      const easing = travelInFlight || offsetDragged ? "ease-out" : "ease";
      // Cancelled rather than layered: two animations on the same property
      // would blend, and what one sees then is neither of the two moves.
      trackAnimationRef.current?.cancel();
      trackAnimationRef.current = track.animate(
        [{ translate: offsetBefore }, { translate: offset }],
        { duration: durationMs * travelRatio, easing },
      );
      // The trait travels with the slides: from where the gesture left it when
      // there was one, from a whole box away when the travel was asked for.
      const progressFrom =
        travelProgressFromRef.current ??
        (travelStep ? travelStep.x || travelStep.y : 0);
      travelProgressFromRef.current = null;
      animateTravelProgress(progressFrom, durationMs * travelRatio, easing);
      // Presses still waiting behind this one: it is already late, so it is
      // sent home at once rather than played out at the pace of someone who
      // has stopped pressing. Someone pressing → four times is asking to be
      // four slides further, not to watch four travels.
      if (pendingRollsRef.current.length) {
        hurryTravel(trackAnimationRef.current);
      }
      // Arrived: the map is the truth again (see settleTravel). Attached before
      // the window's own roll back just below, so the stage is struck first and
      // whatever that one renders is drawn from the map.
      trackAnimationRef.current.finished.then(settleTravel, () => {
        // cancelled by the next travel — that one carries the stage on
      });
    } else if (
      stage &&
      !dragRef.current?.axis &&
      trackAnimationRef.current?.playState !== "running"
    ) {
      // Staged with nothing left to play: a travel that was drawn and then had
      // its animation taken away (a duration set to 0, a re-render landing
      // between the two). Struck at once rather than left standing, since the
      // thing it was standing for is over. A gesture in hand is a stage that is
      // standing for something — the finger still holding it.
      settleTravel();
    }
    // A window waiting for its travel to be over (see goToArea's own loop
    // branch): the animation says when, and says it about the move that just
    // started rather than about a duration counted out beside it.
    const rollBack = rollBackRef.current;
    if (rollBack) {
      rollBackRef.current = null;
      if (travels) {
        trackAnimationRef.current.finished.then(rollBack, () => {
          // cancelled by the next travel — that one answers for it
        });
      } else {
        requestAnimationFrame(rollBack);
      }
    }
    // The keyboard is on a slide about to go out of reach and nobody has moved
    // it: inert would drop it on the floor (document.body), so it is handed to
    // the slide on screen instead. No event to read — this travel was asked for
    // by code — so the transfer has nothing but the modality to go on.
    if (focusIsLeaving) {
      // Nobody pressed anything here, so what is focused is content by
      // definition — but it is still the slide being left that has to remember
      // it, and it has to be done before inert takes it away.
      const leavingElement = slideElements.find(
        (slideElement) =>
          slideElement !== currentElement &&
          slideElement.contains(document.activeElement),
      );
      if (leavingElement) {
        rememberFocus(leavingElement, document.activeElement);
      }
      handOverFocus(
        currentElement,
        prepareFocusTransfer(undefined, debugFocus),
        undefined,
      );
    }
    // Out of reach LAST, once the keyboard has already moved on: a browser
    // takes the focus off an element the moment it becomes inert, and on its
    // own schedule — doing this first would let that undo the landing above and
    // leave the focus on nothing.
    for (const slideElement of slideElements) {
      slideElement.toggleAttribute("inert", slideElement !== currentElement);
    }
    // What is on screen now, for the travel after this one to depart from.
    // While a travel is playing the stage is the one that knows (it holds the
    // slide being travelled TO, which is what one is looking at), so this is
    // only ever written at rest.
    if (!stageRef.current) {
      drawnAreaRef.current = currentArea;
    }
    // The finger has the last word: everything above drew the map at rest, and
    // where the track actually is right now is where the gesture put it.
    paintDrag();
  });

  /**
   * @returns {boolean} whether it moved — false is "there was nowhere to go",
   *   which is what lets a key that changes nothing keep its own meaning.
   */
  const goToArea = (area, { forward, event, value, dx = 0, dy = 0 } = {}) => {
    // A window mid-roll cannot travel yet: it is on its way somewhere and the
    // content that goes with it has not moved, so a second travel would be
    // about a picture nobody is looking at. The press is not lost though — it
    // waits for the roll to end, which is what makes three quick presses on a
    // carousel move three steps instead of one.
    if (rollingRef.current) {
      pendingRollsRef.current.push({ area, forward, event, value, dx, dy });
      // And the one in flight is sent home: waiting out a travel at its own
      // pace before the next one starts is what makes a carousel feel
      // unresponsive — the press has to show on screen while the finger is
      // still down, and here that means arriving, then setting off again.
      hurryTravel(trackAnimationRef.current);
      return true;
    }
    const { slideElements, placeOf } = readMap();
    const currentElement =
      slideElements.find((slideElement) =>
        slideElement.hasAttribute("data-current"),
      ) || slideElements[0];
    if (!area || area === readArea(currentElement)) {
      return false;
    }
    if (forward === undefined) {
      // Asked for by name (--navi-go-to-slide, --navi-back) rather than by a
      // direction: which way it is is still a fact, read off the map, and it is
      // what says which of the two locks below applies.
      const from = placeOf.get(readArea(currentElement)) || { x: 0, y: 0 };
      const to = placeOf.get(area) || { x: 0, y: 0 };
      forward = to.y === from.y ? to.x > from.x : to.y > from.y;
    }
    // The one gate every way out goes through — a key, a command, a button, an
    // event dispatched by hand: a slide that holds on to the user holds them
    // whatever they press. Read off the slide being LEFT, because that is what
    // has a reason to keep them (an answer still missing, a step not taken).
    if (
      currentElement?.hasAttribute(
        forward ? "data-prevent-nav-next" : "data-prevent-nav-previous",
      )
    ) {
      return false;
    }
    // The focus moves here, while the event that asked for it is still in hand:
    // who pressed what, and whether they were on the keyboard, is knowable now
    // and gone a render later. The slide arriving is made reachable on the spot
    // for that — it is out of reach only because it was not on screen, and it is
    // about to be.
    const arrivingElement = slideElements.find(
      (slideElement) => readArea(slideElement) === area,
    );
    if (arrivingElement) {
      const focusedElement = document.activeElement;
      const focusIsLoose =
        !focusedElement ||
        focusedElement === document.body ||
        focusedElement === containerRef.current ||
        currentElement.contains(focusedElement);
      if (focusIsLoose) {
        // What the slide being left was left on, so coming back comes back to
        // it — the way out one pressed excepted (see rememberFocus).
        rememberFocus(currentElement, focusedElement);
        arrivingElement.removeAttribute("inert");
        focusHandOverRef.current = {
          area,
          focusTransfer: prepareFocusTransfer(event, debugFocus),
          event,
        };
      }
    }
    if (value !== undefined) {
      setValueByArea((previous) => ({ ...previous, [area]: value }));
    }
    cameFromRef.current = {
      ...cameFromRef.current,
      [area]: readArea(currentElement),
    };
    // Which way this travel is drawn, said by what asked for it rather than
    // read off the map: a window stepping off its last slide comes back on its
    // first, and between those two places the map says "all the way back" when
    // the press said "one forward". Nothing to say when the travel was asked
    // for by name — there the map is the only one who knows.
    travelStepRef.current =
      dx || dy ? { x: Math.sign(dx), y: Math.sign(dy) } : null;
    if (loop) {
      // A window does not change slide, it rolls: the travel plays, and once it
      // is over the window is put back where it rests while whoever owns the
      // content moves it one step. Both in the same tick — the return to rest
      // and the new content are the same picture, and a render between them
      // would show the old one in the new place.
      rollingRef.current = true;
      setRollingArea(area);
      rollBackRef.current = () => {
        rollingRef.current = false;
        setRollingArea(null);
        setNoTravel(true);
        onLoop?.({ area, dx, dy, event });
      };
      return true;
    }
    const leftArea = readArea(currentElement);
    setCurrentAreaState(area);
    if (!onCurrentChange) {
      return true;
    }
    // What asked for this, read off the interaction rather than carried down
    // from every caller: it is a fact about the event, and the event is here.
    // A caller writing the change somewhere that keeps a trace — the URL, a
    // history — needs it to know whether a place was aimed at or browsed past.
    const cause = causeOfEvent(event);
    if (commit === "rest") {
      // The travel first, the change once it is over: a caller putting it
      // somewhere expensive or visible (the URL, the address bar, a server)
      // must not be asked for it sixty times a second, and the picture must not
      // wait for it either. The container holds the slide it is travelling to
      // until the answer comes — being ahead of its controller for the length of
      // one travel is the whole point.
      setProvisionalArea(area);
      commitAtRestRef.current = { area, leftArea, cause, event };
      return true;
    }
    answerCurrentChange(onCurrentChange(area, { cause, event }), leftArea);
    return true;
  };

  // What a caller says back about a change it was told about: nothing, or a
  // refusal. `false` refuses it — a guard that says no, a session that is gone —
  // and a promise refuses it late, once whatever it had to ask has answered. A
  // refused change is undone here, so what one sees never disagrees with what
  // the caller holds: the slide goes back where it came from.
  const answerCurrentChange = (answer, leftArea) => {
    if (answer === false) {
      goBackToRefusedArea(leftArea);
      return;
    }
    if (answer && typeof answer.then === "function") {
      answer.then((value) => {
        if (value === false) {
          goBackToRefusedArea(leftArea);
        }
      });
    }
  };
  const goBackToRefusedArea = (leftArea) => {
    setProvisionalArea(null);
    setCurrentAreaState(leftArea);
  };

  // The press kept during a roll, taken once the window rests and the travel is
  // given back (noTravel off): by direction when there was one, so it is read
  // against the map as it is NOW — the content moved one step under the window
  // in between.
  useLayoutEffect(() => {
    if (noTravel || rollingRef.current || !pendingRollsRef.current.length) {
      return;
    }
    const { area, dx, dy, event, value } = pendingRollsRef.current.shift();
    if (dx || dy) {
      move(dx, dy, event, value);
      return;
    }
    goToArea(area, { event, value });
  }, [noTravel]);

  // Hand the focus to a slide: what it was left on if it remembers something,
  // and otherwise the ladder every container uses — which passes over the ways
  // out (they say so themselves, see SlideNavButton).
  //
  // A slide with nothing focusable in it leaves the ladder empty-handed, and
  // that is what this box is for: it takes the keyboard itself (see its own
  // tabIndex), so the arrows keep working and the ring says where one is.
  //
  // In two steps, and they are two different moments — the same split every
  // openable surface makes (a dialog's openEffect transfers focus once the
  // dialog is OPEN, not when it was asked to open). `prepareFocusTransfer` has
  // to read the interaction — which element a mousedown landed on, whether the
  // modality is the keyboard — while the event is still being dispatched. The
  // landing waits for the slide to say its DOM is settled (settleFocus below),
  // which is later than one would think: a travel hands the slide a value
  // (useSlideValue) and that value reaches it through context, so Preact
  // re-renders the slide in a flush of its own — the container's own layout
  // effect runs BEFORE its children have seen the value. A screen keyed by it,
  // a form whose uncontrolled fields must start again from a new prefill,
  // replaces its whole subtree there. Landing before that took the focus to a
  // node about to be thrown away, and the focus went to document.body with it.
  const handOverFocus = (slideElement, focusTransfer, event) => {
    focusTransfer.transferFocus(event, slideElement);
    // Asked of the SLIDE, not of this box: the box contains itself, so asking
    // it would answer "yes, it is here" for the very case this is about — a
    // slide with nothing focusable, where the keyboard is already on the box
    // and must be put back on it, if only to say so with a ring the modality of
    // this travel decides (arriving by key shows one, by click does not).
    const containerEl = containerRef.current;
    if (containerEl && !slideElement.contains(document.activeElement)) {
      if (document.activeElement === containerEl) {
        // Already here, and .focus() on what is already focused does nothing at
        // all — the browser will not reconsider its focus ring for it. So the
        // focus is given up for an instant and taken back, which is the only
        // way to say "same place, but arrived at with the keyboard this time":
        // travelling by key from a box that was clicked into must show a ring.
        containerEl.blur();
      }
      containerEl.focus({
        preventScroll: true,
        focusVisible: focusTransfer.focusVisible,
      });
    }
  };

  // A slide reporting that its DOM is settled (its own layout effect, see
  // Slide) — the moment the transfer prepared in goToArea can land. Every
  // slide reports on every commit; only the one a transfer is waiting for,
  // and only while it is the current one, takes it.
  const settleFocus = (slideArea) => {
    const focusHandOver = focusHandOverRef.current;
    if (!focusHandOver || focusHandOver.area !== slideArea) {
      return;
    }
    const slideElement = readMap().slideElements.find(
      (slideElement) => readArea(slideElement) === slideArea,
    );
    if (!slideElement || !slideElement.hasAttribute("data-current")) {
      return;
    }
    focusHandOverRef.current = null;
    handOverFocus(
      slideElement,
      focusHandOver.focusTransfer,
      focusHandOver.event,
    );
  };

  /**
   * @returns {string|undefined} the area one step that way, if there is one.
   *   Nothing there means the direction is simply not offered — no wrapping, no
   *   nearest-match: a map is read as a map, and a move landing nowhere would
   *   break that reading. Walks over its own cells first, so a spanning area
   *   leaves by its far edge rather than onto itself.
   */
  const areaTowards = (dx, dy) => {
    const { slideElements, areaAt, placeOf } = readMap();
    const currentElement =
      slideElements.find((slideElement) =>
        slideElement.hasAttribute("data-current"),
      ) || slideElements[0];
    const currentArea = readArea(currentElement);
    let { x, y } = placeOf.get(currentArea) || { x: 0, y: 0 };
    // How far the line being walked goes, needed only by a window: stepping off
    // one of its ends comes back on the other, since a window has no ends.
    const line = loop
      ? [...areaAt.keys()]
          .map((key) => key.split(",").map(Number))
          .filter(([cellX, cellY]) => (dx ? cellY === y : cellX === x))
          .map(([cellX, cellY]) => (dx ? cellX : cellY))
      : null;
    const first = line ? Math.min(...line) : 0;
    const last = line ? Math.max(...line) : 0;
    let steps = 0;
    while (true) {
      x += dx;
      y += dy;
      if (loop) {
        if (dx) {
          x = x < first ? last : x > last ? first : x;
        } else {
          y = y < first ? last : y > last ? first : y;
        }
      } else if (x < 0 || y < 0) {
        return undefined;
      }
      const area = areaAt.get(`${x},${y}`);
      if (area === currentArea || (loop && area === undefined)) {
        // A hole, or a cell of the area one is already on: keep walking — and
        // give up once the whole line has been walked, which only happens when
        // there is nowhere else on it to go.
        if (loop && (steps += 1) > line.length) {
          return undefined;
        }
        continue;
      }
      return area;
    }
  };
  const move = (dx, dy, event, value) =>
    goToArea(areaTowards(dx, dy), {
      forward: dx > 0 || dy > 0,
      event,
      value,
      dx,
      dy,
    });

  // "next"/"previous" are the same movement said without a direction, which is
  // all a line ever needs: to the right, or downwards when that is where the
  // slides are. On a map they mean the same thing, and fall back to the other
  // axis when there is nothing that way — a step onwards, however the screens
  // happen to be arranged.
  const moveNext = (event) =>
    vertical
      ? move(0, 1, event) || move(1, 0, event)
      : move(1, 0, event) || move(0, 1, event);
  const movePrevious = (event) =>
    vertical
      ? move(0, -1, event) || move(-1, 0, event)
      : move(-1, 0, event) || move(0, -1, event);

  // Where the track is right now, as the gesture left it: the resting place of
  // the slide being dragged, plus what the pointer has pulled since.
  const paintDrag = () => {
    const drag = dragRef.current;
    const track = trackRef.current;
    // Nothing to paint for a pointer that is only resting on the box: until it
    // has an axis a gesture has moved nothing and knows no geometry.
    if (!drag || !drag.axis || !track) {
      return;
    }
    const x = drag.baseOffset.x + drag.pull.x;
    const y = drag.baseOffset.y + drag.pull.y;
    drag.offset = `${x}px ${y}px`;
    track.style.setProperty("--slide-container-offset", drag.offset);
    paintTravelProgress(drag.progress, drag.areaPulled);
  };

  // Where the picture stands relative to the slide that is CURRENT, in boxes:
  // 0 on it, +1 one whole box before it, -1 one box after. Written on the
  // container so an indicator drawn inside the box — a tab bar, a dot row, a
  // trait — follows the finger in CSS alone, with nothing measured and no
  // render per frame. Said about the current slide rather than about the
  // gesture, so the number stays continuous when the travel commits and the
  // current slide changes under it.
  const paintTravelProgress = (progress, area) => {
    const containerEl = containerRef.current;
    if (!containerEl) {
      return;
    }
    if (!progress) {
      containerEl.style.removeProperty("--slide-travel-progress");
      containerEl.removeAttribute("data-slide-travel-to");
      return;
    }
    containerEl.style.setProperty("--slide-travel-progress", progress);
    if (area) {
      containerEl.setAttribute("data-slide-travel-to", area);
    } else {
      containerEl.removeAttribute("data-slide-travel-to");
    }
  };

  // The indicator, brought home at the pace of the travel it belongs to: the
  // same duration and the same easing as the track, so the trait and the slides
  // are one movement. The value it lands on is the one nothing writes (0), so
  // the animation is left to fall away on its own.
  const animateTravelProgress = (from, durationMs, easing) => {
    const containerEl = containerRef.current;
    progressAnimationRef.current?.cancel();
    progressAnimationRef.current = null;
    paintTravelProgress(0);
    if (!containerEl || !from || !durationMs) {
      return;
    }
    progressAnimationRef.current = containerEl.animate(
      [{ "--slide-travel-progress": from }, { "--slide-travel-progress": 0 }],
      { duration: durationMs, easing },
    );
    progressAnimationRef.current.finished.then(
      () => {
        progressAnimationRef.current = null;
      },
      () => {
        // cancelled by the next travel — that one says where the trait goes
      },
    );
  };

  // The two slides the gesture can bring in, placed one box either side of the
  // one being dragged — the same stage a travel builds, except that both ends
  // are set up at once because the finger has not said yet which way it goes.
  const stageDrag = (drag) => {
    const { slideElements, placeOf } = readMap();
    const step = drag.axis === "x" ? { x: 1, y: 0 } : { x: 0, y: 1 };
    const placeByArea = new Map();
    placeByArea.set(drag.area, drag.basePlace);
    if (drag.areaBack) {
      placeByArea.set(drag.areaBack, {
        x: drag.basePlace.x - step.x,
        y: drag.basePlace.y - step.y,
      });
    }
    if (drag.areaOn) {
      placeByArea.set(drag.areaOn, {
        x: drag.basePlace.x + step.x,
        y: drag.basePlace.y + step.y,
      });
    }
    stageRef.current = { placeByArea, area: drag.area };
    for (const slideElement of slideElements) {
      const area = readArea(slideElement);
      const { x, y } = placeByArea.get(area) ||
        placeOf.get(area) || { x: 0, y: 0 };
      slideElement.style.setProperty(
        "--slide-offset",
        `${x * 100}% ${y * 100}%`,
      );
      slideElement.toggleAttribute(
        "data-slide-offstage",
        !placeByArea.has(area),
      );
    }
  };

  // Let go of without enough of a gesture to travel: the slide comes back to
  // where it was, over the distance it was pulled — so a slide barely moved
  // snaps back and one dragged most of the way there takes its time.
  const returnToRest = (drag) => {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    const restOffset = `${drag.baseOffset.x}px ${drag.baseOffset.y}px`;
    const durationMs = durationToMs(duration);
    const pulled = Math.abs(drag.pull[drag.axis]);
    const size = drag.axis === "x" ? drag.box.width : drag.box.height;
    trackAnimationRef.current?.cancel();
    trackAnimationRef.current = null;
    track.style.setProperty("--slide-container-offset", restOffset);
    if (!durationMs || !pulled) {
      paintTravelProgress(0);
      settleTravel();
      return;
    }
    animateTravelProgress(
      drag.progress,
      durationMs * (pulled / size),
      "ease-out",
    );
    const animation = track.animate(
      [{ translate: drag.offset }, { translate: restOffset }],
      { duration: durationMs * (pulled / size), easing: "ease-out" },
    );
    trackAnimationRef.current = animation;
    animation.finished.then(settleTravel, () => {
      // cancelled by a travel asked for since — that one carries the stage on
    });
  };

  // A press on the box, handed to the one thing that knows what a drag-travel
  // is (see drag_travel.js): the rules of the gesture are read there, the
  // geometry of the slides here.
  const startDrag = (pointerDownEvent) => {
    if (!travelByDrag || dragRef.current) {
      return;
    }
    // A window mid-roll has nothing to drag yet: it is on its way somewhere and
    // the content that goes with it has not moved (see goToArea).
    if (rollingRef.current) {
      return;
    }
    // Touching a travel that is playing STOPS it, right there, before the
    // gesture has said anything about itself. Not at the first pixels that
    // decide an axis: over those the slides go on at their own speed under a
    // finger already resting on them, and when the gesture finally takes them
    // they are pinned to a hand moving at a quite different pace — the slide
    // does not jump, it stops dead, which is what a hand reads as a jolt and as
    // "it got away from me".
    // A press that turns out to be nothing lets the travel carry on from where
    // it was caught (see caughtTravel below).
    let caughtTravel = null;
    const trackCaught = trackRef.current;
    const travelCaught = trackAnimationRef.current;
    if (travelCaught && travelCaught.playState === "running") {
      const onScreenPx = trackOffsetPx(trackCaught, containerRef.current);
      const offsetOnScreen = `${onScreenPx.x}px ${onScreenPx.y}px`;
      travelCaught.cancel();
      // Where it was, held: cancelling an animation puts the track back on the
      // value underneath it, which is the far end of the travel — the very jump
      // this is about.
      trackCaught.style.setProperty("--slide-container-offset", offsetOnScreen);
      caughtTravel = {
        onScreenPx,
        offsetOnScreen,
        offsetTarget: offsetRef.current,
      };
    }
    // The travel in hand, as the slides see it: where the one being dragged
    // stands, what is either side of it, and how far the finger has taken it.
    const drag = {
      axis: null,
      area: null,
      areaBack: null,
      areaOn: null,
      areaPulled: null,
      box: null,
      basePlace: null,
      baseOffset: null,
      pull: { x: 0, y: 0 },
      progress: 0,
      offset: null,
      gesture: null,
    };
    const gesture = startDragTravel(pointerDownEvent, {
      element: containerRef.current,
      axes: dragAxes,
      // Caught in flight: the hand is already in the gesture, so it is answered
      // from its first pixel rather than after a threshold it has no reason to
      // cross twice.
      immediate: Boolean(caughtTravel),
      onStart: ({ axis, sign, target }) => {
        const areaBack = axis === "x" ? areaTowards(-1, 0) : areaTowards(0, -1);
        const areaOn = axis === "x" ? areaTowards(1, 0) : areaTowards(0, 1);
        // Everything positional is read HERE rather than when the pointer
        // landed: the travel that was playing then may have arrived since, and
        // it is what the slides are doing at the moment the gesture takes them
        // over that the gesture must carry on from.
        const track = trackRef.current;
        const { slideElements, placeOf } = readMap();
        const currentElement =
          slideElements.find((slideElement) =>
            slideElement.hasAttribute("data-current"),
          ) || slideElements[0];
        const box = track.getBoundingClientRect();
        if (
          (!areaBack && !areaOn) ||
          !currentElement ||
          !box.width ||
          !box.height ||
          // Something else with a better claim on the gesture: a scroller
          // between the finger and the slide, with room left that way.
          scrollRoomTowards(target, currentElement, axis, sign)
        ) {
          return false;
        }
        const area = readArea(currentElement);
        // Where the slide being dragged stands: where the stage put it while a
        // travel is playing, its place on the map otherwise.
        const stage = stageRef.current;
        const basePlace = stage?.placeByArea.get(area) ||
          placeOf.get(area) || { x: 0, y: 0 };
        const baseOffset = {
          x: -basePlace.x * box.width,
          y: -basePlace.y * box.height,
        };
        // Where the track IS: a travel grabbed mid-flight was already stopped
        // where the eye saw it, at the press — this only reads that place, so
        // the gesture starts from it rather than from where the map rests.
        const onScreen = caughtTravel ? caughtTravel.onScreenPx : baseOffset;
        caughtTravel = null;
        trackAnimationRef.current?.cancel();
        trackAnimationRef.current = null;
        progressAnimationRef.current?.cancel();
        progressAnimationRef.current = null;
        drag.axis = axis;
        drag.areaBack = areaBack;
        drag.areaOn = areaOn;
        drag.area = area;
        drag.box = box;
        drag.basePlace = basePlace;
        drag.baseOffset = baseOffset;
        const size = axis === "x" ? box.width : box.height;
        // Where the track was when the gesture took it over — nowhere, unless
        // it was travelling. Every pull is measured from it.
        const slack =
          axis === "x" ? onScreen.x - baseOffset.x : onScreen.y - baseOffset.y;
        drag.pull = { x: 0, y: 0, [axis]: slack };
        drag.progress = slack / size;
        stageDrag(drag);
        containerRef.current.toggleAttribute("data-slide-dragging", true);
        return {
          size,
          slack,
          travelBack: Boolean(areaBack),
          travelOn: Boolean(areaOn),
        };
      },
      onPull: ({ axis, pulled, progress }) => {
        drag.pull = { ...drag.pull, [axis]: pulled };
        drag.progress = progress;
        drag.areaPulled = pulled > 0 ? drag.areaBack : drag.areaOn;
        paintDrag();
      },
      onEnd: ({ axis, sign, travels, event }) => {
        dragRef.current = null;
        containerRef.current?.removeAttribute("data-slide-dragging");
        if (!travels) {
          returnToRest(drag);
          return;
        }
        // Where the slide is being left, for the travel to depart from instead
        // of from the map.
        travelFromRef.current = drag.offset;
        // …and where the indicator is being left, said about the slide that is
        // ARRIVING: the picture is `sign` of a box short of it, and that is
        // what the travel about to be drawn has to close.
        travelProgressFromRef.current = drag.progress - sign;
        const moved =
          axis === "x" ? move(-sign, 0, event) : move(0, -sign, event);
        if (!moved) {
          // Nowhere to go after all — a slide holding on to the user
          // (preventNav), or a caller that refused the change.
          travelFromRef.current = null;
          travelProgressFromRef.current = null;
          returnToRest(drag);
          return;
        }
        // A container whose `current` is held outside and was not moved:
        // nothing rendered, so nothing drew the travel and the track is still
        // under where the finger left it. One frame is all it takes to know.
        requestAnimationFrame(() => {
          if (travelFromRef.current) {
            travelFromRef.current = null;
            travelProgressFromRef.current = null;
            returnToRest(drag);
          }
        });
      },
      onGiveUp: () => {
        dragRef.current = null;
        // A press that never became a gesture: what it stopped goes on its way,
        // from where the finger caught it and over what is left of the travel.
        if (!caughtTravel || !trackCaught) {
          return;
        }
        const {
          offsetOnScreen,
          offsetTarget,
          onScreenPx: caughtOnScreenPx,
        } = caughtTravel;
        caughtTravel = null;
        if (offsetOnScreen === offsetTarget) {
          settleTravel();
          return;
        }
        const durationMs = durationToMs(duration);
        // What is LEFT of it, at the pace it had: a travel caught nine tenths
        // of the way there and let go of does not start its duration again.
        const boxRect = trackCaught.getBoundingClientRect();
        const targetPx = offsetToPx(offsetTarget, boxRect);
        const leftToCover = Math.abs(
          drag.axis === "y"
            ? targetPx.y - caughtOnScreenPx.y
            : targetPx.x - caughtOnScreenPx.x,
        );
        const size = drag.axis === "y" ? boxRect.height : boxRect.width;
        const travelRatio = size ? leftToCover / size : 1;
        trackCaught.style.setProperty("--slide-container-offset", offsetTarget);
        trackAnimationRef.current = trackCaught.animate(
          [{ translate: offsetOnScreen }, { translate: offsetTarget }],
          { duration: durationMs * travelRatio, easing: "ease-out" },
        );
        trackAnimationRef.current.finished.then(settleTravel, () => {
          // taken over by a travel asked for since
        });
      },
    });
    if (!gesture) {
      return;
    }
    drag.gesture = gesture;
    dragRef.current = drag;
  };

  // A gesture is listening on things that outlive this component.
  useLayoutEffect(() => {
    return () => {
      dragRef.current?.gesture?.stop();
      dragRef.current = null;
      progressAnimationRef.current?.cancel();
    };
  }, []);

  // Arrows walk the map, Home/End jump to its ends — but only where those keys
  // mean nothing else: applyKeyboardShortcuts refuses to intercept a key the
  // focused element has a native use for, so an arrow inside a text field still
  // moves the caret and only a press with nothing else to do travels. Each
  // arrow means its own direction, so the key always matches what one sees
  // move. A shortcut that moved nothing returns null and the key goes back to
  // the page (scrolling, most likely).
  const travelled = (moved) => (moved ? false : null);
  const goToEnd = (last, event) => {
    const { order } = readMap();
    const area = last ? order[order.length - 1] : order[0];
    return goToArea(area, { forward: last, event });
  };
  // Each handler is given the key press that ran it, and hands it on: what the
  // travel does about the focus is decided from the interaction that asked for
  // it (see goToArea), so it has to reach that far.
  const onKeyDownShortcuts = createOnKeyDownForShortcuts({
    // A shortcut that is not offered is not the same as one that does nothing:
    // `enabled` leaves the key to whatever else wants it (see
    // keyboard_shortcuts.js), rather than swallowing it here.
    arrowright: {
      enabled: travelByKeyboard,
      handler: (e) => travelled(move(1, 0, e)),
    },
    arrowleft: {
      enabled: travelByKeyboard,
      handler: (e) => travelled(move(-1, 0, e)),
    },
    arrowdown: {
      enabled: travelByKeyboard,
      handler: (e) => travelled(move(0, 1, e)),
    },
    arrowup: {
      enabled: travelByKeyboard,
      handler: (e) => travelled(move(0, -1, e)),
    },
    home: {
      enabled: travelByKeyboard,
      handler: (e) => travelled(goToEnd(false, e)),
    },
    end: {
      enabled: travelByKeyboard,
      handler: (e) => travelled(goToEnd(true, e)),
    },
  });

  return (
    // Box rather than a plain div: it is how every navi component takes the
    // onnavi_* handlers below — they are navi's own event names, and Box is
    // what carries them onto the element.
    <Box
      {...rest}
      ref={containerRef}
      baseClassName="navi_slide_container"
      data-slide-container=""
      // Which axes a touch may travel on, said in the DOM: what the browser
      // does with a finger is decided by CSS (touch-action) before any of this
      // has seen the gesture.
      data-travel-by-drag={dragAxes ?? undefined}
      // The same fact, read by the shared gesture stylesheet: what scrolls
      // inside a box that travels must not spill onto the page behind it (see
      // drag_travel.js).
      data-drag-travel={dragAxes ?? undefined}
      onPointerDown={(e) => {
        startDrag(e);
        rest.onPointerDown?.(e);
      }}
      // The focusable one, and a Tab stop: a slide is not (see Slide), so the
      // keyboard lands on what the current slide holds, and on this box when it
      // holds nothing. It is also what makes the arrows and Home/End reachable
      // at all — a keyboard shortcut only reaches what has the focus.
      tabIndex={rest.tabIndex ?? 0}
      // "not me, unless you have nothing else": whoever hands the focus here —
      // a popup opening, a slide arriving — reads this the same way (see
      // findFocusTarget), so this box takes the keyboard only when what is on
      // screen holds nothing that can.
      navi-autofocus="last-resort"
      // "the box around me may draw my focus ring instead of me": a container
      // filling a dialog or a popover has its ring land on the very edge the
      // popup already outlines, and two rings a pixel apart read as a mistake.
      // The popup answers this attribute (see dialog.jsx / popover.jsx) and
      // silences the ring below through --navi-focus-outline-style.
      data-focus-outline-delegate=""
      // Focusable and a surface, so it says what state it is in — and
      // :focus-visible is what the ring below is drawn from.
      pseudoClasses={SLIDE_CONTAINER_PSEUDO_CLASSES}
      // A direction, never a step: on a map "next" only means something when
      // there is a single axis to walk, so everything that moves a slide — a
      // chevron, --navi-left/right/up/down, a line of code — says which way.
      // Dispatch it (bubbling) from anywhere inside to move.
      onnavi_slide_move={(e) => {
        const { dx, dy, value } = e.detail;
        // `e`, not e.detail.event: a navi event carries the chain it came from
        // (a --navi-right command carries the click that ran it, that click its
        // own mousedown), and the focus transfer reads the whole chain to know
        // where the interaction started.
        move(dx, dy, e, value);
      }}
      // By name rather than by direction (--navi-go-to-slide): the caller says
      // where, the map says nothing about it.
      onnavi_slide_go_to={(e) => {
        const { area, value } = e.detail;
        goToArea(area, { event: e, value });
      }}
      // …the ends of the walk (--navi-first / --navi-last): the same jump
      // Home and End make, said as a command so a nav bar can offer it.
      onnavi_slide_end={(e) => {
        goToEnd(e.detail.last, e);
      }}
      // …and a step along it (--navi-previous / --navi-next), for a container
      // laid out as a line: which direction that is is this container's own
      // business (a row goes right, a column goes down), which is exactly what
      // a command saying "onwards" leaves to it.
      onnavi_slide_step={(e) => {
        if (e.detail.goal === "next") {
          moveNext(e);
        } else {
          movePrevious(e);
        }
      }}
      // …and back where one came from (--navi-back).
      onnavi_slide_back={(e) => {
        const { slideElements } = readMap();
        const currentElement = slideElements.find((slideElement) =>
          slideElement.hasAttribute("data-current"),
        );
        const cameFrom = cameFromRef.current[readArea(currentElement)];
        if (cameFrom) {
          goToArea(cameFrom, { event: e });
        }
      }}
      // …and the protocol every command target answers: without this the
      // command resolves, finds this element, and nothing runs.
      onnavi_command={(e) => {
        onNaviCommand(e);
      }}
      onKeyDown={(e) => {
        onKeyDownShortcuts(e);
        rest.onKeyDown?.(e);
      }}
      style={rest.style}
    >
      <div data-slide-track="" ref={trackRef}>
        <SlideContainerContext.Provider
          value={{ vertical, answeredAreas, done, valueByArea, settleFocus }}
        >
          {children}
        </SlideContainerContext.Provider>
      </div>
    </Box>
  );
};

/**
 * One slide, and its own place on the map: it renders the element the container
 * moves, so anything can put one there — a fragment, a .map(), a component of
 * your own — without the container having to recognise it.
 *
 * It is both SlideContainer.Item and an export of its own: <Slide> where the
 * container is far above, SlideContainer.Item where the two sit side by side.
 *
 * @param {object} props
 * @param {string} [props.area] - which area of the map it is. Defaults to its
 *   id, so a slide that is already named is not named twice.
 * @param {boolean} [props.required] - this step has to be answered before the
 *   ones after it can be reached: it holds the user until something inside it
 *   says it is done (`--navi-done`, which a Form triggers on a successful
 *   send), and lets go afterwards. What makes a slide reachable ONLY by
 *   answering the one before it — an arrow key or a "next" button cannot skip
 *   ahead to a screen that has nothing to show yet. Answering a step
 *   un-answers the ones after it, since what they were answered about has just
 *   changed.
 * @param {boolean} [props.preventNav] - hold the user here, whichever way they
 *   try to leave.
 * @param {boolean} [props.preventNavNext] - hold them from going right or down.
 * @param {boolean} [props.preventNavPrevious] - …left or up.
 */
export const Slide = ({
  area,
  required,
  preventNav,
  preventNavNext = preventNav,
  preventNavPrevious = preventNav,
  children,
  ...rest
}) => {
  const container = useContext(SlideContainerContext);
  const slideArea = area ?? rest.id;
  const answered = Boolean(container?.answeredAreas.includes(slideArea));
  const holdsUntilAnswered = Boolean(required) && !answered;
  const nextIsLocked = Boolean(preventNavNext) || holdsUntilAnswered;

  const locks = useMemo(
    () => ({ preventNavNext: nextIsLocked, preventNavPrevious }),
    [nextIsLocked, preventNavPrevious],
  );
  // What the travel into this slide carried, if anything (see useSlideValue).
  const slideValue = container?.valueByArea?.[slideArea];
  // This slide's DOM is settled — said after EVERY commit, no dependency
  // array, because it is a fact about the render that just happened, not a
  // reaction to a particular prop. The container is the one holding a focus
  // transfer waiting for it (see settleFocus): a travel's value reaches this
  // slide through context one flush after the container moved, and what it
  // shows (a form keyed by a prefill) is only final here.
  useLayoutEffect(() => {
    container?.settleFocus?.(slideArea);
  });
  return (
    <SlideContext.Provider value={locks}>
      <SlideValueContext.Provider value={slideValue}>
        <Box
          flex="y"
          // Not focusable: the keyboard goes to what is IN a slide, and when a
          // slide holds nothing, to the container around it (see
          // SlideContainer's own tabIndex). One stop for the whole thing rather
          // than one per screen — the shape a wheel and its values already have.
          {...rest}
          // The protocol every command target answers — a slide is one now
          // (--navi-done). navi_command does not bubble, so the container's own
          // handler is not an answer for what was aimed here.
          onnavi_command={(e) => {
            onNaviCommand(e);
            rest.onnavi_command?.(e);
          }}
          // What was in this slide says it is finished (a form that just sent —
          // see resolveAfterSend in commands.js). It says nothing about where to
          // go: that is read here, from this slide's own place in the walk.
          onnavi_done={(e) => {
            // Dropped imperatively rather than left to the re-render this
            // schedules: moving on happens in this same handler, and the gate it
            // goes through reads this attribute off the DOM (see goToArea) — a
            // render is a microtask away, the move is not.
            e.currentTarget.removeAttribute("data-prevent-nav-next");
            container?.done(slideArea);
            rest.onnavi_done?.(e);
          }}
          data-slide=""
          data-slide-area={slideArea}
          data-prevent-nav-next={nextIsLocked ? "" : undefined}
          data-prevent-nav-previous={preventNavPrevious ? "" : undefined}
          // A surface one interacts with says what state it is in, the way every
          // other surface does — a dialog carries the very same set.
          // :focus-within is the one a slide is really about: it is what tells
          // the slide holding the keyboard from the ones waiting.
          pseudoClasses={SLIDE_PSEUDO_CLASSES}
        >
          {children}
        </Box>
      </SlideValueContext.Provider>
    </SlideContext.Provider>
  );
};

const SLIDE_CONTAINER_PSEUDO_CLASSES = [
  ":hover",
  ":active",
  ":focus",
  ":focus-visible",
  ":focus-within",
];

const SLIDE_PSEUDO_CLASSES = [
  ":hover",
  ":active",
  ":focus",
  ":focus-visible",
  ":focus-within",
];

const DIRECTIONS = {
  right: {
    dx: 1,
    dy: 0,
    command: "--navi-right",
    Svg: ChevronRightSvg,
    label: "Slide on the right",
  },
  left: {
    dx: -1,
    dy: 0,
    command: "--navi-left",
    Svg: ChevronLeftSvg,
    label: "Slide on the left",
  },
  down: {
    dx: 0,
    dy: 1,
    command: "--navi-down",
    Svg: ChevronDownSvg,
    label: "Slide below",
  },
  up: {
    dx: 0,
    dy: -1,
    command: "--navi-up",
    Svg: ChevronUpSvg,
    label: "Slide above",
  },
};

const SlideNavButton = ({ ChevronSvg, locked, ...rest }) => (
  <Button
    // Read-only, not disabled and not hidden: the way out stays visible and
    // explainable (it can still be reached, hovered, described) — it just does
    // nothing while the slide is holding on to the user.
    readOnly={Boolean(locked)}
    // "not me, unless you have nothing else": arriving on a way out means the
    // first thing offered is leaving again, so whoever hands out the focus —
    // a slide arriving, a dialog holding slides opening — lands on what there
    // is to do instead. It stays perfectly focusable by a click or by Tab, and
    // a slide holding nothing but its chevrons does land on one: there was
    // nothing else, which is exactly what this says.
    autoFocus="last-resort"
    icon
    variant="discrete"
    // Takes the focus like any other button, on purpose. It used to refuse it
    // (mousedown.preventDefault) to keep the keyboard where the user had put
    // it — but pressing a way out with nothing focused then left the keyboard
    // on nothing at all: the travel below only hands the focus to the slide
    // arriving when it was leaving a slide, so a click from document.body
    // arrived on document.body, and the next Tab started from the top of the
    // page rather than from what is on screen.
    //
    // Letting it focus is both the plain behaviour of a button and what makes
    // the rest fall into place: the press lands on the chevron, the slide left
    // behind remembers it (see focusMemory) and hands the keyboard to the slide
    // arriving, which prefers anything but its own ways out (see
    // findFocusTargetInSlide) — so one arrives on what there is to do. Coming
    // back the other way lands on the chevron one left by, which is where the
    // eye and the hand already are.
    {...rest}
  >
    {/* An affordance, not a character: it is sized to be aimed at, so it may be
        drawn bigger than the text it sits next to. A slide with no way out
        reserves the room one would take (visibility + inert) rather than the
        chevron shrinking to fit the line. */}
    <Icon lineOverflow="allow">
      <ChevronSvg />
    </Icon>
  </Button>
);

/**
 * The way out of a slide, and the way into the next one. Nothing but the
 * command plus the chevron that matches the travel: a row goes left/right, a
 * column up/down — so the button points where the slide actually goes without
 * the caller having to keep the two in sync.
 */
/**
 * A way out pointing where it goes. It says a direction, not a slide: what is
 * over there is the map's business, and moving a screen changes nothing here.
 * Four of them, matching the four commands (`--navi-left` and friends) — a map
 * has four ways out, and a component per direction is what makes that obvious
 * at the call site.
 *
 * @param {object} props
 * @param {"right"|"left"|"down"|"up"} props.direction
 */
const SlideMove = ({ direction, ...rest }) => {
  const locks = useContext(SlideContext);
  const { dx, dy, command, Svg, label } = DIRECTIONS[direction];
  const forward = dx > 0 || dy > 0;
  const locked = forward ? locks?.preventNavNext : locks?.preventNavPrevious;
  return (
    <SlideNavButton
      command={command}
      locked={locked}
      ChevronSvg={Svg}
      aria-label={label}
      {...rest}
    />
  );
};

// "All the way that way": the first slide of the walk, or the last one. Not a
// direction — a map reads its own order — so it is its own component rather
// than a fifth arrow.
const SlideEnd = ({ last, ...rest }) => (
  <SlideNavButton
    command={last ? "--navi-last" : "--navi-first"}
    ChevronSvg={last ? ChevronLastSvg : ChevronFirstSvg}
    aria-label={last ? "Last slide" : "First slide"}
    {...rest}
  />
);
const SlideFirst = (props) => <SlideEnd {...props} last={false} />;
const SlideLast = (props) => <SlideEnd {...props} last />;

const SlideLeft = (props) => <SlideMove {...props} direction="left" />;
const SlideRight = (props) => <SlideMove {...props} direction="right" />;
const SlideUp = (props) => <SlideMove {...props} direction="up" />;
const SlideDown = (props) => <SlideMove {...props} direction="down" />;

SlideContainer.Item = Slide;
SlideContainer.Left = SlideLeft;
SlideContainer.Right = SlideRight;
SlideContainer.Up = SlideUp;
SlideContainer.Down = SlideDown;
SlideContainer.First = SlideFirst;
SlideContainer.Last = SlideLast;
