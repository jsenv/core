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

import { createContext, toChildArray } from "preact";
import { useContext, useState } from "preact/hooks";
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
        /* So a slide shorter than the box still fills it: the box is as big as
           its largest slide, and the others stretch to it rather than floating
           in a corner of it. */
        display: grid;
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

// What the slides tell the buttons inside them: only which way they travel, so
// a button can point the right way without being told twice.
const SlideListContext = createContext(null);

/**
 * Horizontal by default — a slide arrives from the side, the way one walks
 * through a form — and vertical with `vertical`, where it arrives from below.
 *
 * The slide shown can be driven from outside (`current` + `onCurrentChange`) or
 * left to the slides themselves, which then answer the
 * --navi-next/--navi-previous commands sent from anything inside them.
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
  const slides = toChildArray(children);
  const slideIds = slides.map(
    (slide, index) => slide.props?.id ?? String(index),
  );
  const [currentState, setCurrentState] = useState(slideIds[0]);
  const current = currentProp ?? currentState;
  const currentIndex = Math.max(0, slideIds.indexOf(current));

  const goTo = (index) => {
    const id = slideIds[Math.max(0, Math.min(index, slides.length - 1))];
    if (id === current) {
      return;
    }
    setCurrentState(id);
    onCurrentChange?.(id);
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
        goTo(currentIndex + e.detail.step);
      }}
      // …and the protocol every command target answers: without this the
      // command resolves, finds this element, and nothing runs.
      onnavi_command={(e) => {
        onNaviCommand(e);
      }}
      style={{ "--slide-list-duration": duration, ...rest.style }}
    >
      <SlideListContext.Provider value={{ vertical }}>
        <div
          data-slide-track=""
          style={{
            "--slide-list-offset": offsetAlongAxis(-currentIndex, vertical),
          }}
        >
          {slides.map((slide, index) => {
            const isCurrent = index === currentIndex;
            return (
              <div
                key={slideIds[index]}
                data-slide=""
                data-current={isCurrent ? "" : undefined}
                data-slide-displaced={isCurrent ? undefined : ""}
                style={{ "--slide-offset": offsetAlongAxis(index, vertical) }}
                aria-hidden={isCurrent ? undefined : "true"}
              >
                {slide}
              </div>
            );
          })}
        </div>
      </SlideListContext.Provider>
    </Box>
  );
};

/**
 * One slide. Nothing but a Box with the id it is moved by — it exists so a
 * slide reads as a slide rather than as a box that happens to carry an id. It
 * is both SlideList.Item and an export of its own: <Slide> where the list is
 * far above, SlideList.Item where the two sit side by side.
 */
export const Slide = ({ children, ...rest }) => (
  <Box flex="y" {...rest}>
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
