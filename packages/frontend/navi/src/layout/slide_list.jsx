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

import { createContext } from "preact";
import { useContext, useLayoutEffect, useRef, useState } from "preact/hooks";
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
        /* Its place in the row, not a movement: same percentage reference as
           the track's own (both are the size of the box), so the distance the
           track travels is exactly the distance between two slides. */
        translate: var(--slide-offset, 0);
      }
      /* Parked: not shown, and not in the way of what is. */
      > [data-slide][data-slide-displaced] {
        pointer-events: none;
      }
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
    let index = 0;
    for (const slideElement of slideElements) {
      slideElement.style.setProperty(
        "--slide-offset",
        offsetAlongAxis(index, vertical),
      );
      const isCurrent = index === currentIndex;
      // Walked past, or not reached yet: out of reach for the pointer and out
      // of the way for a screen reader, so only the slide on screen answers.
      slideElement.toggleAttribute("data-current", isCurrent);
      slideElement.toggleAttribute("data-slide-displaced", !isCurrent);
      if (isCurrent) {
        slideElement.removeAttribute("aria-hidden");
      } else {
        slideElement.setAttribute("aria-hidden", "true");
      }
      index++;
    }
    track.style.setProperty(
      "--slide-list-offset",
      offsetAlongAxis(-currentIndex, vertical),
    );
  });

  const goBy = (step) => {
    const track = trackRef.current;
    const slideElements = Array.from(track.children);
    const currentIndex = slideElements.findIndex((slideElement) =>
      slideElement.hasAttribute("data-current"),
    );
    const nextIndex = Math.max(
      0,
      Math.min(currentIndex + step, slideElements.length - 1),
    );
    const nextElement = slideElements[nextIndex];
    if (!nextElement || nextIndex === currentIndex) {
      return;
    }
    // An id is how a slide is named from outside; without one it can still be
    // travelled to, it just cannot be asked for by name.
    setCurrentState(nextElement.id || undefined);
    if (nextElement.id) {
      onCurrentChange?.(nextElement.id);
    }
  };

  return (
    // Box rather than a plain div: it is how every navi component takes the
    // onnavi_* handlers below — they are navi's own event names, and Box is
    // what carries them onto the element.
    <Box
      {...rest}
      baseClassName="navi_slide_list"
      data-slide-list=""
      // The event a --navi-next/--navi-previous command ends up dispatching…
      onnavi_slide_list_go={(e) => {
        goBy(e.detail.step);
      }}
      // …and the protocol every command target answers: without this the
      // command resolves, finds this element, and nothing runs.
      onnavi_command={(e) => {
        onNaviCommand(e);
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
export const Slide = ({ children, ...rest }) => (
  <Box flex="y" {...rest} data-slide="">
    {children}
  </Box>
);

/**
 * The way out of a slide, and the way into the next one. Nothing but the
 * command plus the chevron that matches the travel: horizontal slides go
 * left/right, vertical ones up/down — so the button points where the slide
 * actually goes without the caller having to keep the two in sync.
 */
const SlideListStep = ({ step, ...rest }) => {
  const context = useContext(SlideListContext);
  const vertical = context?.vertical;
  const isNext = step === "next";
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
      icon
      variant="discrete"
      aria-label={isNext ? "Next slide" : "Previous slide"}
      {...rest}
    >
      <Icon>
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
