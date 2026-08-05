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
import { onNaviCommand } from "../control/commands.js";
import { useDebugFocus } from "../navi_debug.jsx";
import { Button } from "../control/input/button.jsx";
import {
  ChevronDownSvg,
  ChevronLeftSvg,
  ChevronRightSvg,
  ChevronUpSvg,
} from "../graphic/icons/chevron_stroke_svg.jsx";
import { createOnKeyDownForShortcuts } from "../keyboard/keyboard_shortcuts.js";
import { Icon } from "../text/icon.jsx";

const css = /* css */ `
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
      translate: var(--slide-container-offset, 0);
      transition: translate var(--slide-container-duration, 300ms) ease;

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
      /* Nothing here for a slide not on screen: [inert] (set from JS) already
         takes it out of reach of the pointer, of Tab and of a screen reader —
         one attribute instead of pointer-events plus aria-hidden, and the only
         one the browser does not argue with about a focused descendant. */
    }
  }
`;

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
 * @param {(area: string) => void} [props.onCurrentChange]
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
 * @param {boolean} [props.keyboardTravel=true] - whether the arrows (and
 *   Home/End) walk the map. On by default: a map one can see is a map one
 *   expects to walk. Off when the arrows mean something else where these slides
 *   are — a list of choices one moves through, a picker whose screens are
 *   steps rather than places — so the keys keep the meaning the content gives
 *   them, and travelling stays something one asks for (a button, a command).
 * @param {string} [props.duration="300ms"] - how long a slide change takes.
 */
export const SlideContainer = ({
  layout = "row",
  current: currentProp,
  defaultCurrent,
  onCurrentChange,
  loop,
  onLoop,
  keyboardTravel = true,
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
  const current = rollingArea ?? currentProp ?? currentAreaState;
  const vertical = layout === "column";
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
    const currentPlace = placeOf.get(readArea(currentElement)) || {
      x: 0,
      y: 0,
    };
    // Read before anything is marked: setting inert below moves the focus out by
    // itself, so afterwards there is no way to tell whether it was inside. A
    // travel asked for from inside has already handed the focus over (see
    // goToArea) and this is false by then; what is left here is the travel
    // nobody asked for — a `current` prop moved from outside, with the keyboard
    // still on the slide about to go out of reach.
    const focusIsLeaving = slideElements.some(
      (slideElement) =>
        slideElement !== currentElement &&
        slideElement.contains(document.activeElement),
    );
    for (const slideElement of slideElements) {
      const { x, y } = placeOf.get(readArea(slideElement)) || { x: 0, y: 0 };
      slideElement.style.setProperty(
        "--slide-offset",
        `${x * 100}% ${y * 100}%`,
      );
      const isCurrent = slideElement === currentElement;
      slideElement.toggleAttribute("data-current", isCurrent);
      slideElement.toggleAttribute("data-slide-displaced", !isCurrent);
      if (isCurrent) {
        // Reachable again first, so the focus below has somewhere to land: an
        // inert element cannot take it.
        slideElement.removeAttribute("inert");
      }
    }
    // Set here rather than left to the style prop, and right before the offset
    // it governs: the two are one decision (this much travel for this move),
    // and a box that applies its style on its own schedule would let them land
    // in different frames — the travel then plays with the duration of the move
    // before it.
    containerRef.current.style.setProperty(
      "--slide-container-duration",
      noTravel ? "0ms" : duration,
    );
    trackRef.current.style.setProperty(
      "--slide-container-offset",
      `${-currentPlace.x * 100}% ${-currentPlace.y * 100}%`,
    );
    // The keyboard is on a slide about to go out of reach and nobody has moved
    // it: inert would drop it on the floor (document.body), so it is handed to
    // the slide on screen instead. No event to read — this travel was asked for
    // by code — so the transfer has nothing but the modality to go on.
    if (focusIsLeaving) {
      handOverFocus(currentElement, undefined);
    }
    // Out of reach LAST, once the keyboard has already moved on: a browser
    // takes the focus off an element the moment it becomes inert, and on its
    // own schedule — doing this first would let that undo the landing above and
    // leave the focus on nothing.
    for (const slideElement of slideElements) {
      slideElement.toggleAttribute("inert", slideElement !== currentElement);
    }
  });

  /**
   * @returns {boolean} whether it moved — false is "there was nowhere to go",
   *   which is what lets a key that changes nothing keep its own meaning.
   */
  const goToArea = (area, { forward, event, value, dx = 0, dy = 0 } = {}) => {
    // A window mid-roll answers to nothing: it is on its way somewhere and the
    // content that goes with it has not moved yet, so a second travel would be
    // about a picture nobody is looking at.
    if (rollingRef.current) {
      return false;
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
        // it — the chevron one pressed included. Written down at the one moment
        // it is known, rather than watched for at every focusin.
        markAutofocusRestore(currentElement, focusedElement);
        arrivingElement.removeAttribute("inert");
        handOverFocus(arrivingElement, event);
      }
    }
    if (value !== undefined) {
      setValueByArea((previous) => ({ ...previous, [area]: value }));
    }
    cameFromRef.current = {
      ...cameFromRef.current,
      [area]: readArea(currentElement),
    };
    if (loop) {
      // A window does not change slide, it rolls: the travel plays, and once it
      // is over the window is put back where it rests while whoever owns the
      // content moves it one step. Both in the same tick — the return to rest
      // and the new content are the same picture, and a render between them
      // would show the old one in the new place.
      rollingRef.current = true;
      setRollingArea(area);
      setTimeout(() => {
        rollingRef.current = false;
        setRollingArea(null);
        setNoTravel(true);
        onLoop?.({ area, dx, dy, event });
      }, durationToMs(duration));
      return true;
    }
    setCurrentAreaState(area);
    onCurrentChange?.(area);
    return true;
  };

  // Hand the focus to a slide: what it was left on if it remembers something,
  // and otherwise the ladder every container uses — which passes over the ways
  // out (they say so themselves, see SlideNavButton).
  //
  // A slide with nothing focusable in it leaves the ladder empty-handed, and
  // that is what this box is for: it takes the keyboard itself (see its own
  // tabIndex), so the arrows keep working and the ring says where one is.
  const handOverFocus = (slideElement, event) => {
    const focusTransfer = prepareFocusTransfer(event, debugFocus);
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
      enabled: keyboardTravel,
      handler: (e) => travelled(move(1, 0, e)),
    },
    arrowleft: {
      enabled: keyboardTravel,
      handler: (e) => travelled(move(-1, 0, e)),
    },
    arrowdown: {
      enabled: keyboardTravel,
      handler: (e) => travelled(move(0, 1, e)),
    },
    arrowup: {
      enabled: keyboardTravel,
      handler: (e) => travelled(move(0, -1, e)),
    },
    home: {
      enabled: keyboardTravel,
      handler: (e) => travelled(goToEnd(false, e)),
    },
    end: {
      enabled: keyboardTravel,
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
          value={{ vertical, answeredAreas, done, valueByArea }}
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

const SlideLeft = (props) => <SlideMove {...props} direction="left" />;
const SlideRight = (props) => <SlideMove {...props} direction="right" />;
const SlideUp = (props) => <SlideMove {...props} direction="up" />;
const SlideDown = (props) => <SlideMove {...props} direction="down" />;

SlideContainer.Item = Slide;
SlideContainer.Left = SlideLeft;
SlideContainer.Right = SlideRight;
SlideContainer.Up = SlideUp;
SlideContainer.Down = SlideDown;
