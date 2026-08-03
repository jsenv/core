/**
 * Pages that replace one another inside one box.
 *
 * Every page sits in the same grid cell, so the box measures itself on the
 * LARGEST of them and nothing resizes as one moves through them; a page travels
 * by exactly one box, so a short one and a tall one move the same distance.
 *
 * The pages live inside the slideshow, which is what makes this work for a
 * popup: a dialog and a popover are both promoted to the browser's top layer,
 * so no container of ours could ever hold two of them side by side and
 * translate the pair. One popup holding a slideshow of contents has no such
 * problem — and it is the same component in the document, in a dialog or in a
 * popover.
 */

import { createContext, toChildArray } from "preact";
import { useContext, useState } from "preact/hooks";
import { Box } from "../../box/box.jsx";
import { Button } from "../input/button.jsx";
import { Icon } from "../../text/icon.jsx";
import {
  ChevronDownSvg,
  ChevronLeftSvg,
  ChevronRightSvg,
  ChevronUpSvg,
} from "../../graphic/icons/chevron_stroke_svg.jsx";
import { onNaviCommand } from "../commands.js";

const css = /* css */ `
  /* Every page in the same grid cell: the box then measures itself on the
     LARGEST of them, in both directions, without anything being measured by
     hand — which is also why nothing here resizes as the pages change. Each
     page travels by exactly one box, so a short one and a tall one move the
     same distance. */
  .navi_slideshow {
    display: grid;
    overflow: hidden;

    > [data-slideshow-page] {
      min-width: 0;
      min-height: 0;
      grid-area: 1 / 1;
      /* So a page shorter than the box still fills it: the box is as big as its
         largest page, and the others stretch to it rather than floating in a
         corner of it. */
      display: grid;
      translate: var(--slideshow-offset, 0);
      transition: translate var(--slideshow-duration, 300ms) ease;
    }
    /* Parked: not shown, and not in the way of what is. */
    > [data-slideshow-page][data-slideshow-displaced] {
      pointer-events: none;
    }
  }
`;

// What a slideshow tells the buttons inside it: only which way it travels, so
// they can point the right way without being told twice.
const SlideShowContext = createContext(null);

/**
 * Horizontal by default — a page arrives from the side, the way one walks
 * through a form — and vertical with `vertical`, where it arrives from below.
 *
 * The page shown can be driven from outside (`current` + `onCurrentChange`) or
 * left to the slideshow, which then answers the --navi-next/--navi-previous
 * commands sent from anything inside it.
 *
 * @param {object} props
 * @param {string} [props.current] - id of the page being shown; omit to let the
 *   slideshow keep it and drive it by command.
 * @param {(id: string) => void} [props.onCurrentChange]
 * @param {boolean} [props.vertical] - pages travel up and down instead of
 *   sideways.
 * @param {string} [props.duration="300ms"] - how long a page change takes.
 */
export const SlideShow = ({
  current: currentProp,
  onCurrentChange,
  vertical,
  duration = "300ms",
  children,
  ...rest
}) => {
  import.meta.css = css;
  const pages = toChildArray(children);
  const pageIds = pages.map((page, index) => page.props?.id ?? String(index));
  const [currentState, setCurrentState] = useState(pageIds[0]);
  const current = currentProp ?? currentState;
  const currentIndex = Math.max(0, pageIds.indexOf(current));

  const goTo = (index) => {
    const id = pageIds[Math.max(0, Math.min(index, pageIds.length - 1))];
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
      baseClassName="navi_slideshow"
      data-slideshow-content=""
      // The event a --navi-next/--navi-previous command ends up dispatching…
      onnavi_slideshow_go={(e) => {
        goTo(currentIndex + e.detail.step);
      }}
      // …and the protocol every command target answers: without this the
      // command resolves, finds this element, and nothing runs.
      onnavi_command={(e) => {
        onNaviCommand(e);
      }}
      style={{ "--slideshow-duration": duration, ...rest.style }}
    >
      <SlideShowContext.Provider value={{ vertical }}>
        {pages.map((page, index) => {
          const isCurrent = index === currentIndex;
          const distance = `${(index - currentIndex) * 100}%`;
          return (
            <div
              key={pageIds[index]}
              data-slideshow-page=""
              data-current={isCurrent ? "" : undefined}
              data-slideshow-displaced={isCurrent ? undefined : ""}
              style={{
                "--slideshow-offset": vertical
                  ? `0 ${distance}`
                  : `${distance} 0`,
              }}
              aria-hidden={isCurrent ? undefined : "true"}
            >
              {page}
            </div>
          );
        })}
      </SlideShowContext.Provider>
    </Box>
  );
};

/**
 * One page. Nothing but a Box with the id the slideshow moves it by — it exists
 * so a page reads as a page rather than as a box that happens to carry an id.
 */
const SlideShowItem = ({ children, ...rest }) => (
  <Box flex="y" {...rest}>
    {children}
  </Box>
);

/**
 * The way out of a page, and the way into the next one. Nothing but the command
 * plus the chevron that matches the travel: a horizontal slideshow goes
 * left/right, a vertical one up/down — so the button points where the page
 * actually goes without the caller having to keep the two in sync.
 */
const SlideShowStep = ({ step, ...rest }) => {
  const slideshow = useContext(SlideShowContext);
  const vertical = slideshow?.vertical;
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
      aria-label={isNext ? "Next page" : "Previous page"}
      {...rest}
    >
      <Icon>
        <ChevronSvg />
      </Icon>
    </Button>
  );
};

const SlideShowNext = (props) => <SlideShowStep {...props} step="next" />;
const SlideShowPrevious = (props) => (
  <SlideShowStep {...props} step="previous" />
);

SlideShow.Item = SlideShowItem;
SlideShow.Next = SlideShowNext;
SlideShow.Previous = SlideShowPrevious;
