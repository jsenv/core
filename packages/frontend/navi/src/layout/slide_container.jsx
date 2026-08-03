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

import { findFocusable } from "@jsenv/dom";
import { createContext } from "preact";
import {
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";
import { Box } from "../box/box.jsx";
import { isMatchingFocusVisible } from "../box/pseudo_styles.js";
import { onNaviCommand } from "../control/commands.js";
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

// What the container tells what is inside it: which way it travels, so a button
// can point the right way without being told twice.
const SlideContainerContext = createContext(null);
// What a slide tells what is inside IT: whether leaving it is allowed right
// now, so its own prev/next buttons say so instead of failing when pressed.
const SlideContext = createContext(null);

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

const readArea = (slideElement) =>
  slideElement.getAttribute("data-slide-area") || slideElement.id || "";

// What each slide had under the keyboard when it gave it up. Per slide, not one
// per container: coming back from the third slide to the first must land where
// the first was left, which a single "previous focus" could not remember.
const focusMemory = new WeakMap();

/**
 * Where the keyboard goes when a slide arrives. What this slide last had wins
 * over everything: coming back is coming back to where one was, chevron
 * included. Failing a memory, a slide is opened to DO something in it, and its
 * prev/next buttons are how one leaves — landing there means the first thing
 * offered is going away again, so they come last, only if nothing else is
 * offered at all.
 */
const findFocusTargetInSlide = (slideElement) => {
  const remembered = focusMemory.get(slideElement);
  if (remembered && slideElement.contains(remembered)) {
    // Where the keyboard was when this slide was left: coming back is coming
    // back to what one was doing, not to the top of the slide. Through
    // findFocusable, because what was focused may have become a wrapper since
    // (or stopped taking focus at all).
    const stillFocusable = findFocusable(remembered);
    if (stillFocusable) {
      return stillFocusable;
    }
  }
  const asked = slideElement.querySelector(
    `[navi-autofocus]:not([navi-autofocus="fallback"]):not([navi-autofocus="restore"])`,
  );
  if (asked) {
    // The mark is not always ON the focusable itself — a control puts it on the
    // box it renders, the field inside being what takes the keyboard.
    const askedFocusable = findFocusable(asked);
    if (askedFocusable) {
      return askedFocusable;
    }
  }
  const focusableButNav = findFocusable(slideElement, {
    exclude: (element) => Boolean(element.closest("[data-slide-nav]")),
  });
  if (focusableButNav) {
    return focusableButNav;
  }
  // Nothing to do in this slide but leave it: the way out is the only thing
  // left to offer.
  return findFocusable(slideElement);
};

/**
 * The slide shown can be driven from outside (`current` + `onCurrentChange`) or
 * left to the container, which then answers the --navi-next/--navi-previous
 * commands sent from anything inside it.
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
 * @param {(area: string) => void} [props.onCurrentChange]
 * @param {string} [props.duration="300ms"] - how long a slide change takes.
 */
export const SlideContainer = ({
  layout = "row",
  current: currentProp,
  onCurrentChange,
  duration = "300ms",
  children,
  ...rest
}) => {
  import.meta.css = css;
  const trackRef = useRef();
  // The area of the slide being shown, not its rank: a rank would be wrong the
  // moment a slide appears before it, and there is nothing to renumber here.
  const [currentState, setCurrentState] = useState(undefined);
  const current = currentProp ?? currentState;
  const vertical = layout === "column";

  const readMap = () => {
    const slideElements = Array.from(trackRef.current.children);
    const map =
      typeof layout === "string"
        ? lineAreas(slideElements, layout)
        : parseAreas(layout);
    return { slideElements, ...map };
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
    // Read before anything is marked: setting inert below moves the focus out
    // by itself, so afterwards there is no way to tell whether it was inside.
    const slideLosingFocus = slideElements.find(
      (slideElement) =>
        slideElement !== currentElement &&
        slideElement.contains(document.activeElement),
    );
    // Not on screen: out of reach for the pointer, for Tab and for a screen
    // reader, so only the slide shown answers. inert rather than aria-hidden +
    // pointer-events: aria-hidden over something focused is refused by the
    // browser (and rightly — it would hide from assistive technology the very
    // thing the keyboard is on), while inert takes the focus away instead of
    // lying about it.
    const focusWasLeaving = Boolean(slideLosingFocus);
    let focusVisible = false;
    if (slideLosingFocus) {
      focusVisible = isMatchingFocusVisible(document.activeElement);
    }
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
    trackRef.current.style.setProperty(
      "--slide-container-offset",
      `${-currentPlace.x * 100}% ${-currentPlace.y * 100}%`,
    );
    // The keyboard was on the slide leaving — usually on the very button that
    // asked to leave it. inert drops that focus on the floor (document.body),
    // so it is handed to the slide arriving instead: the next Tab starts where
    // the eye is, and the button that answers Enter is one of those on screen.
    // Not conditioned on the focus having already left: inert takes it away on
    // its own schedule, and waiting for that would leave a frame where the
    // keyboard is nowhere.
    if (focusWasLeaving) {
      const target = findFocusTargetInSlide(currentElement);
      if (target) {
        // The ring follows the modality, not the transfer: arriving by keyboard
        // shows it, arriving by click does not — same reading as a popup
        // handing focus to its content (see focus_transfer.js).
        target.focus({ preventScroll: true, focusVisible });
      }
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
  const goToArea = (area, { forward } = {}) => {
    const { slideElements } = readMap();
    const currentElement =
      slideElements.find((slideElement) =>
        slideElement.hasAttribute("data-current"),
      ) || slideElements[0];
    if (!area || area === readArea(currentElement)) {
      return false;
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
    setCurrentState(area);
    onCurrentChange?.(area);
    return true;
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
    while (true) {
      x += dx;
      y += dy;
      if (x < 0 || y < 0) {
        return undefined;
      }
      const area = areaAt.get(`${x},${y}`);
      if (area === currentArea) {
        continue;
      }
      return area;
    }
  };
  const move = (dx, dy) =>
    goToArea(areaTowards(dx, dy), { forward: dx > 0 || dy > 0 });

  // "next"/"previous" are the same movement said without a direction, which is
  // all a line ever needs: to the right, or downwards when that is where the
  // slides are. On a map they mean the same thing, and fall back to the other
  // axis when there is nothing that way — a step onwards, however the screens
  // happen to be arranged.
  const moveNext = () =>
    vertical ? move(0, 1) || move(1, 0) : move(1, 0) || move(0, 1);
  const movePrevious = () =>
    vertical ? move(0, -1) || move(-1, 0) : move(-1, 0) || move(0, -1);

  // Arrows walk the map, Home/End jump to its ends — but only where those keys
  // mean nothing else: applyKeyboardShortcuts refuses to intercept a key the
  // focused element has a native use for, so an arrow inside a text field still
  // moves the caret and only a press with nothing else to do travels. Each
  // arrow means its own direction, so the key always matches what one sees
  // move. A shortcut that moved nothing returns null and the key goes back to
  // the page (scrolling, most likely).
  const travelled = (moved) => (moved ? false : null);
  const goToEnd = (last) => {
    const { order } = readMap();
    const area = last ? order[order.length - 1] : order[0];
    return goToArea(area, { forward: last });
  };
  const onKeyDownShortcuts = createOnKeyDownForShortcuts({
    arrowright: () => travelled(move(1, 0)),
    arrowleft: () => travelled(move(-1, 0)),
    arrowdown: () => travelled(move(0, 1)),
    arrowup: () => travelled(move(0, -1)),
    home: () => travelled(goToEnd(false)),
    end: () => travelled(goToEnd(true)),
  });

  return (
    // Box rather than a plain div: it is how every navi component takes the
    // onnavi_* handlers below — they are navi's own event names, and Box is
    // what carries them onto the element.
    <Box
      {...rest}
      baseClassName="navi_slide_container"
      data-slide-container=""
      // One event per direction, no step to read: "next" is what a button, a
      // command and a line of code all mean, and it is all any of them has to
      // say. Dispatch it (bubbling) from anywhere inside to move on — an action
      // finishing, a field becoming valid…
      onnavi_next={() => {
        moveNext();
      }}
      onnavi_previous={() => {
        movePrevious();
      }}
      // …and the one a Move button dispatches, for a map where "next" has no
      // meaning but "down" does.
      onnavi_slide_move={(e) => {
        const { dx, dy } = e.detail;
        move(dx, dy);
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
      // Written down as it happens rather than when the slide is left: what the
      // keyboard was on IS what it was on, chevron included — one leaves a
      // slide by pressing its "next", so that is where coming back belongs.
      onfocusin={(e) => {
        const slideElement = e.target.closest?.("[data-slide]");
        if (slideElement) {
          focusMemory.set(slideElement, e.target);
        }
        rest.onfocusin?.(e);
      }}
      style={{ "--slide-container-duration": duration, ...rest.style }}
    >
      <div data-slide-track="" ref={trackRef}>
        <SlideContainerContext.Provider value={{ vertical }}>
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
 * @param {boolean} [props.preventNav] - hold the user here, whichever way they
 *   try to leave.
 * @param {boolean} [props.preventNavNext] - hold them from going right or down.
 * @param {boolean} [props.preventNavPrevious] - …left or up.
 */
export const Slide = ({
  area,
  preventNav,
  preventNavNext = preventNav,
  preventNavPrevious = preventNav,
  children,
  ...rest
}) => {
  const locks = useMemo(
    () => ({ preventNavNext, preventNavPrevious }),
    [preventNavNext, preventNavPrevious],
  );
  return (
    <SlideContext.Provider value={locks}>
      <Box
        flex="y"
        {...rest}
        data-slide=""
        data-slide-area={area ?? rest.id}
        data-prevent-nav-next={preventNavNext ? "" : undefined}
        data-prevent-nav-previous={preventNavPrevious ? "" : undefined}
      >
        {children}
      </Box>
    </SlideContext.Provider>
  );
};

const DIRECTIONS = {
  right: { dx: 1, dy: 0, Svg: ChevronRightSvg, label: "Slide on the right" },
  left: { dx: -1, dy: 0, Svg: ChevronLeftSvg, label: "Slide on the left" },
  down: { dx: 0, dy: 1, Svg: ChevronDownSvg, label: "Slide below" },
  up: { dx: 0, dy: -1, Svg: ChevronUpSvg, label: "Slide above" },
};

const SlideNavButton = ({ ChevronSvg, locked, ...rest }) => (
  <Button
    // Read-only, not disabled and not hidden: the way out stays visible and
    // explainable (it can still be reached, hovered, described) — it just does
    // nothing while the slide is holding on to the user.
    readOnly={Boolean(locked)}
    // The way OUT of a slide: marked so the focus arriving in a slide can
    // prefer anything else (see findFocusTargetInSlide).
    data-slide-nav=""
    icon
    variant="discrete"
    // Acts on the press, and never takes the focus: a chevron pressed with the
    // mouse would be focused for the length of one travel and then lose it to
    // the slide arriving — leaving behind the impression that the keyboard
    // moved, and, worse, a slide REMEMBERING the chevron as the last thing it
    // had (see focusMemory). Preventing the mousedown default keeps the focus
    // where the user put it, which is what makes the next arrival predictable;
    // the same trick a callout uses to stay out of the way of its input.
    // Nothing is lost by acting one event earlier — there is nothing to change
    // one's mind about between mousedown and click.
    actionOnMouseDown
    {...rest}
    onMouseDown={(e) => {
      e.preventDefault();
      rest.onMouseDown?.(e);
    }}
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
const SlideStep = ({ step, ...rest }) => {
  const context = useContext(SlideContainerContext);
  const locks = useContext(SlideContext);
  const vertical = context?.vertical;
  const isNext = step === "next";
  const locked = isNext ? locks?.preventNavNext : locks?.preventNavPrevious;
  const direction = vertical
    ? isNext
      ? "down"
      : "up"
    : isNext
      ? "right"
      : "left";
  return (
    <SlideNavButton
      command={isNext ? "--navi-next" : "--navi-previous"}
      locked={locked}
      ChevronSvg={DIRECTIONS[direction].Svg}
      aria-label={isNext ? "Next slide" : "Previous slide"}
      {...rest}
    />
  );
};

/**
 * A way out pointing where it goes, for a map where "next" says nothing but
 * "down" does. It says a direction, not a slide: what is over there is the
 * map's business, and moving a screen changes nothing here.
 *
 * @param {object} props
 * @param {"right"|"left"|"down"|"up"} props.direction
 */
const SlideMove = ({ direction, ...rest }) => {
  const locks = useContext(SlideContext);
  const { dx, dy, Svg, label } = DIRECTIONS[direction];
  const forward = dx > 0 || dy > 0;
  const locked = forward ? locks?.preventNavNext : locks?.preventNavPrevious;
  return (
    <SlideNavButton
      locked={locked}
      ChevronSvg={Svg}
      aria-label={label}
      {...rest}
      onMouseDown={(e) => {
        // preventDefault (and the travel itself) is SlideNavButton's; this only
        // says where to go.
        e.currentTarget.dispatchEvent(
          new CustomEvent("navi_slide_move", {
            detail: { dx, dy },
            bubbles: true,
          }),
        );
        rest.onMouseDown?.(e);
      }}
    />
  );
};

const SlideNext = (props) => <SlideStep {...props} step="next" />;
const SlidePrevious = (props) => <SlideStep {...props} step="previous" />;

SlideContainer.Item = Slide;
SlideContainer.Next = SlideNext;
SlideContainer.Previous = SlidePrevious;
SlideContainer.Move = SlideMove;
