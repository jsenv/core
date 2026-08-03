/**
 * A list of slides that replace one another inside one box.
 *
 * Every slide sits in the same grid cell, so the box measures itself on the
 * LARGEST of them and nothing resizes as one moves through them; a slide
 * travels by exactly one box, so a short one and a tall one move the same
 * distance.
 *
 * The slides live INSIDE the box, which is what makes this work for a popup: a
 * dialog and a popover are both promoted to the browser's top layer, so no
 * container of ours could ever hold two of them side by side and translate the
 * pair. One popup holding slides of its own contents has no such problem — and
 * it is the same component in the document, in a dialog or in a popover.
 */

import { findFocusable } from "@jsenv/dom";
import { createContext } from "preact";
import { isMatchingFocusVisible } from "../box/pseudo_styles.js";
import { createOnKeyDownForShortcuts } from "../keyboard/keyboard_shortcuts.js";
import {
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";
import { Box } from "../box/box.jsx";
import { Button } from "../control/input/button.jsx";
import { Icon } from "../text/icon.jsx";
import {
  ChevronDownSvg,
  ChevronLeftSvg,
  ChevronRightSvg,
  ChevronUpSvg,
} from "../graphic/icons/chevron_stroke_svg.jsx";
import { onNaviCommand } from "../control/commands.js";

const css = /* css */ `
  /* Every slide in the same grid cell: the box then measures itself on the
     LARGEST of them, in both directions, without anything being measured by
     hand — which is also why nothing here resizes as the slides change. Each
     slide travels by exactly one box, so a short one and a tall one move the
     same distance. */
  .navi_slide_list {
    display: grid;
    min-width: 0;
    min-height: 0;
    /* Never bigger than what holds it: a list is as big as its largest slide,
       but a slide scrolls its own body, so the room it would need is not room
       it must be given. Shrinking is enough for that (the slides then scroll);
       GROWING is a decision the caller makes with expandY, for a list that
       must fill a container it does not need — see the dialog demo. */
    flex: 0 1 auto;
    /* Passed down rather than owned: the list is usually the whole content of
       a rounded popup, and a slide (with its header) has to follow that curve
       — nothing between them may flatten it on the way. */
    border-radius: inherit;
    overflow: hidden;

    /* ONE thing moves: the track. The slides are laid out once and for all,
       each a whole box further than the one before it, and never transition —
       so two neighbours cannot end up a pixel apart mid-travel the way two
       transitions running side by side can. It also means one transitionend,
       one duration, one easing, whatever the number of slides. */
    > [data-slide-track] {
      display: grid;
      min-width: 0;
      min-height: 0;
      grid-area: 1 / 1;
      translate: var(--slide-list-offset, 0);
      transition: translate var(--slide-list-duration, 300ms) ease;

      > [data-slide] {
        /* All in the one cell, so the list is as big as its largest slide and
           the others stretch to it (grid stretches by default) rather than
           floating in a corner of it. No display of its own here: a slide is a
           Box and keeps whatever it was given. */
        min-width: 0;
        min-height: 0;
        grid-area: 1 / 1;
        /* Square, deliberately: two rounded slides passing each other leave a
           pinched gap between their curves where the page shows through. The
           corners belong to the LIST, which clips them (overflow: hidden
           above) — so what one sees is rounded at rest and butt-jointed in
           motion, with nothing between two slides at any point of the travel. */
        border-radius: 0;
        /* Its place in the row, not a movement: same percentage reference as
           the track's own (both are the size of the box), so the distance the
           track travels is exactly the distance between two slides. */
        translate: var(--slide-offset, 0);
      }
      /* Nothing here for a slide walked past: [inert] (set from JS) already
         takes it out of reach of the pointer, of Tab and of a screen reader —
         one attribute instead of pointer-events plus aria-hidden, and the only
         one the browser does not argue with about a focused descendant. */
    }
  }
`;

// A distance in boxes, written on the axis the list travels along.
const offsetAlongAxis = (boxes, vertical) => {
  const distance = `${boxes * 100}%`;
  return vertical ? `0 ${distance}` : `${distance} 0`;
};

// What the list tells what is inside it: which way it travels, so a button can
// point the right way without being told twice.
const SlideListContext = createContext(null);
// What a slide tells what is inside IT: whether leaving it is allowed right
// now, so its own prev/next buttons say so instead of failing when pressed.
const SlideContext = createContext(null);

// What each slide had under the keyboard when it gave it up. Per slide, not one
// per list: coming back from the third slide to the first must land where the
// first was left, which a single "previous focus" could not remember.
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
 * Horizontal by default — a slide arrives from the side, the way one walks
 * through a form — and vertical with `vertical`, where it arrives from below.
 *
 * The slide shown can be driven from outside (`current` + `onCurrentChange`) or
 * left to the list, which then answers the --navi-next/--navi-previous commands
 * sent from anything inside it.
 *
 * Which slides there are is read from the DOM, not from the children: a slide
 * is whatever <Slide> put there, wherever it came from — a fragment, a .map(),
 * a component of your own wrapping one. Nothing here assumes the children ARE
 * the slides, so nothing breaks when they are not.
 *
 * @param {object} props
 * @param {string} [props.current] - id of the slide being shown; omit to keep
 *   it here and drive it by command.
 * @param {(id: string) => void} [props.onCurrentChange]
 * @param {boolean} [props.vertical] - slides travel up and down instead of
 *   sideways.
 * @param {string} [props.duration="300ms"] - how long a slide change takes.
 */
export const SlideList = ({
  current: currentProp,
  onCurrentChange,
  vertical,
  duration = "300ms",
  children,
  ...rest
}) => {
  import.meta.css = css;
  const trackRef = useRef();
  // The id of the slide being shown, not its rank: a rank would be wrong the
  // moment a slide appears before it, and there is nothing to renumber here.
  const [currentState, setCurrentState] = useState(undefined);
  const current = currentProp ?? currentState;

  // Everything positional is decided here, from the DOM, once per render: where
  // each slide stands in the line, which one is current, and how far the track
  // must be for that one to be the one on screen. Reading the DOM is what makes
  // the children free — their shape says nothing about the order, the elements
  // do — and it is also the only place that has to agree with itself.
  useLayoutEffect(() => {
    const track = trackRef.current;
    const slideElements = Array.from(track.children);
    if (slideElements.length === 0) {
      return;
    }
    let currentIndex = slideElements.findIndex(
      (slideElement) => slideElement.id === current,
    );
    if (currentIndex === -1) {
      // Nothing named, or a name nothing answers to: the first slide is the one
      // shown, the way a stack of pages opens on its first page.
      currentIndex = 0;
    }
    // Read before anything is marked: setting inert below moves the focus out
    // by itself, so afterwards there is no way to tell whether it was inside.
    const slideLosingFocus = slideElements.find(
      (slideElement, slideIndex) =>
        slideIndex !== currentIndex &&
        slideElement.contains(document.activeElement),
    );
    // Walked past, or not reached yet: out of reach for the pointer, for Tab
    // and for a screen reader, so only the slide on screen answers. inert
    // rather than aria-hidden + pointer-events: aria-hidden over something
    // focused is refused by the browser (and rightly — it would hide from
    // assistive technology the very thing the keyboard is on), while inert
    // takes the focus away instead of lying about it.
    const focusWasLeaving = Boolean(slideLosingFocus);
    let focusVisible = false;
    if (slideLosingFocus) {
      focusVisible = isMatchingFocusVisible(document.activeElement);
    }
    let index = 0;
    for (const slideElement of slideElements) {
      slideElement.style.setProperty(
        "--slide-offset",
        offsetAlongAxis(index, vertical),
      );
      const isCurrent = index === currentIndex;
      slideElement.toggleAttribute("data-current", isCurrent);
      slideElement.toggleAttribute("data-slide-displaced", !isCurrent);
      if (isCurrent) {
        // Reachable again first, so the focus below has somewhere to land: an
        // inert element cannot take it.
        slideElement.removeAttribute("inert");
      }
      index++;
    }
    track.style.setProperty(
      "--slide-list-offset",
      offsetAlongAxis(-currentIndex, vertical),
    );
    // The keyboard was on the slide leaving — usually on the very button that
    // asked to leave it. inert drops that focus on the floor (document.body),
    // so it is handed to the slide arriving instead: the next Tab starts where
    // the eye is, and the button that answers Enter is one of those on screen.
    // Not conditioned on the focus having already left: inert takes it away on
    // its own schedule, and waiting for that would leave a frame where the
    // keyboard is nowhere.
    if (focusWasLeaving) {
      const slideArriving = slideElements[currentIndex];
      const target = findFocusTargetInSlide(slideArriving);
      if (target) {
        // The ring follows the modality, not the transfer: arriving by keyboard
        // shows it, arriving by click does not — same reading as a popup
        // handing focus to its content (see focus_transfer.js).
        target.focus({ preventScroll: true, focusVisible });
      }
    }
    // Out of reach LAST, once the keyboard has already moved on: a browser
    // takes the focus off an element the moment it becomes inert, and on its
    // own schedule — doing this first would let that undo the landing above
    // and leave the focus on nothing.
    index = 0;
    for (const slideElement of slideElements) {
      slideElement.toggleAttribute("inert", index !== currentIndex);
      index++;
    }
  });

  /**
   * @param {(currentIndex: number, lastIndex: number) => number} pickIndex
   * @returns {boolean} whether it moved — false is "there was nowhere to go",
   *   which is what lets a key that changes nothing keep its own meaning.
   */
  const goTo = (pickIndex) => {
    const track = trackRef.current;
    const slideElements = Array.from(track.children);
    const currentIndex = slideElements.findIndex((slideElement) =>
      slideElement.hasAttribute("data-current"),
    );
    const lastIndex = slideElements.length - 1;
    const wantedIndex = pickIndex(currentIndex, lastIndex);
    const nextIndex = Math.max(0, Math.min(wantedIndex, lastIndex));
    const nextElement = slideElements[nextIndex];
    if (!nextElement || nextIndex === currentIndex) {
      return false;
    }
    // The one gate every way out goes through — a key, a command, a button, an
    // event dispatched by hand: a slide that holds on to the user holds them
    // whatever they press. Read off the slide being LEFT, because that is what
    // has a reason to keep them (an answer still missing, a step not taken).
    const slideBeingLeft = slideElements[currentIndex];
    const forward = nextIndex > currentIndex;
    if (
      slideBeingLeft?.hasAttribute(
        forward ? "data-prevent-nav-next" : "data-prevent-nav-previous",
      )
    ) {
      return false;
    }
    // An id is how a slide is named from outside; without one it can still be
    // travelled to, it just cannot be asked for by name.
    setCurrentState(nextElement.id || undefined);
    if (nextElement.id) {
      onCurrentChange?.(nextElement.id);
    }
    return true;
  };
  const goBy = (step) => goTo((currentIndex) => currentIndex + step);

  // Arrows walk the list, Home/End jump to its ends — but only where those keys
  // mean nothing else: applyKeyboardShortcuts refuses to intercept a key the
  // focused element has a native use for, so an arrow inside a text field still
  // moves the caret and only a press with nothing else to do travels. Along the
  // axis only: a horizontal list answers left/right, a vertical one up/down, so
  // the key always matches what one sees move. A shortcut that moved nothing
  // returns null and the key goes back to the page (scrolling, most likely).
  const travelled = (moved) => (moved ? false : null);
  const onKeyDownShortcuts = createOnKeyDownForShortcuts({
    [vertical ? "arrowdown" : "arrowright"]: () => travelled(goBy(1)),
    [vertical ? "arrowup" : "arrowleft"]: () => travelled(goBy(-1)),
    home: () => travelled(goTo(() => 0)),
    end: () => travelled(goTo((currentIndex, lastIndex) => lastIndex)),
  });

  return (
    // Box rather than a plain div: it is how every navi component takes the
    // onnavi_* handlers below — they are navi's own event names, and Box is
    // what carries them onto the element.
    <Box
      {...rest}
      baseClassName="navi_slide_list"
      data-slide-list=""
      // One event per direction, no step to read: "next" is what a button, a
      // command and a line of code all mean, and it is all any of them has to
      // say. Dispatch it (bubbling) from anywhere inside to move the list on —
      // an action finishing, a field becoming valid…
      onnavi_next={() => {
        goBy(1);
      }}
      onnavi_previous={() => {
        goBy(-1);
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
      // Written down as it happens rather than when the slide is left: what
      // the keyboard was on IS what it was on, chevron included — one leaves a
      // slide by pressing its "next", so that is where coming back belongs.
      onfocusin={(e) => {
        const slideElement = e.target.closest?.("[data-slide]");
        if (slideElement) {
          focusMemory.set(slideElement, e.target);
        }
        rest.onfocusin?.(e);
      }}
      style={{ "--slide-list-duration": duration, ...rest.style }}
    >
      <div data-slide-track="" ref={trackRef}>
        <SlideListContext.Provider value={{ vertical }}>
          {children}
        </SlideListContext.Provider>
      </div>
    </Box>
  );
};

/**
 * One slide, and its own place in the line: it renders the element the list
 * moves, so anything can put one there — a fragment, a .map(), a component of
 * your own — without the list having to recognise it.
 *
 * It is both SlideList.Item and an export of its own: <Slide> where the list is
 * far above, SlideList.Item where the two sit side by side.
 */
export const Slide = ({
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
        data-prevent-nav-next={preventNavNext ? "" : undefined}
        data-prevent-nav-previous={preventNavPrevious ? "" : undefined}
      >
        {children}
      </Box>
    </SlideContext.Provider>
  );
};

/**
 * The way out of a slide, and the way into the next one. Nothing but the
 * command plus the chevron that matches the travel: horizontal slides go
 * left/right, vertical ones up/down — so the button points where the slide
 * actually goes without the caller having to keep the two in sync.
 */
const SlideListStep = ({ step, ...rest }) => {
  const context = useContext(SlideListContext);
  const locks = useContext(SlideContext);
  const vertical = context?.vertical;
  const isNext = step === "next";
  // Read-only, not disabled and not hidden: the way out stays visible and
  // explainable (it can still be reached, hovered, described) — it just does
  // nothing while the slide is holding on to the user.
  const locked = isNext ? locks?.preventNavNext : locks?.preventNavPrevious;
  const ChevronSvg = vertical
    ? isNext
      ? ChevronDownSvg
      : ChevronUpSvg
    : isNext
      ? ChevronRightSvg
      : ChevronLeftSvg;
  return (
    <Button
      command={isNext ? "--navi-next" : "--navi-previous"}
      readOnly={Boolean(locked)}
      // The way OUT of a slide: marked so the focus arriving in a slide can
      // prefer anything else (see findFocusTargetInSlide).
      data-slide-nav=""
      icon
      variant="discrete"
      aria-label={isNext ? "Next slide" : "Previous slide"}
      {...rest}
    >
      {/* lineOverflow: the chevron may be drawn bigger than the text it sits
          next to, but it must not make the line taller — a header with a way
          out and one without have to be the same height, or a slide travelling
          would visibly change the top of the box. */}
      <Icon lineOverflow="allow">
        <ChevronSvg />
      </Icon>
    </Button>
  );
};

const SlideListNext = (props) => <SlideListStep {...props} step="next" />;
const SlideListPrevious = (props) => (
  <SlideListStep {...props} step="previous" />
);

SlideList.Item = Slide;
SlideList.Next = SlideListNext;
SlideList.Previous = SlideListPrevious;
