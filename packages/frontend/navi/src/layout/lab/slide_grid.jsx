/**
 * EXPERIMENT — what a slide list becomes when the slides are not in a line.
 *
 * A list only knows "before" and "after", which forces every screen into one
 * order: pick → create → edit, where edit is really beside pick, not after
 * create. Placing the slides on a GRID says what the screens actually are —
 * one below, one to the right — and the travel then goes where the eye expects.
 *
 * Everything else is slide_list.jsx's: the slides sit in one cell each, the
 * track is the only thing that moves (one transition, no seam), and whatever is
 * not on screen is inert. What changes is that a slide carries a place (x, y)
 * instead of a rank, and that travelling takes a direction rather than a step.
 *
 * If this holds up, SlideList becomes the special case of it — a grid one cell
 * wide — and the component takes a name that does not promise a line.
 */

import { findFocusable } from "@jsenv/dom";
import { createContext } from "preact";
import { useContext, useLayoutEffect, useRef, useState } from "preact/hooks";
import { Box } from "../../box/box.jsx";
import { Button } from "../../control/input/button.jsx";
import { createOnKeyDownForShortcuts } from "../../keyboard/keyboard_shortcuts.js";
import { Icon } from "../../text/icon.jsx";
import {
  ChevronDownSvg,
  ChevronLeftSvg,
  ChevronRightSvg,
  ChevronUpSvg,
} from "../../graphic/icons/chevron_stroke_svg.jsx";

const css = /* css */ `
  .navi_slide_grid {
    display: grid;
    min-width: 0;
    min-height: 0;
    flex: 0 1 auto;
    overflow: hidden;

    > [data-slide-track] {
      display: grid;
      min-width: 0;
      min-height: 0;
      grid-area: 1 / 1;
      translate: var(--slide-grid-offset, 0);
      transition: translate var(--slide-grid-duration, 300ms) ease;

      > [data-slide] {
        min-width: 0;
        min-height: 0;
        grid-area: 1 / 1;
        border-radius: 0;
        /* Its place on the grid, in boxes: a slide two columns to the right
           sits two boxes to the right, and the track moving by the same
           amount is what brings it on screen. */
        translate: var(--slide-offset, 0);
      }
    }
  }
`;

const SlideGridContext = createContext(null);

const readPlace = (slideElement) => ({
  x: Number(slideElement.getAttribute("data-slide-x") || 0),
  y: Number(slideElement.getAttribute("data-slide-y") || 0),
});

/**
 * @param {object} props
 * @param {string} [props.current] - id of the slide on screen.
 * @param {(id: string) => void} [props.onCurrentChange]
 * @param {string} [props.duration="300ms"]
 */
export const SlideGrid = ({
  current: currentProp,
  onCurrentChange,
  duration = "300ms",
  children,
  ...rest
}) => {
  import.meta.css = css;
  const trackRef = useRef();
  const [currentState, setCurrentState] = useState(undefined);
  const current = currentProp ?? currentState;

  useLayoutEffect(() => {
    const track = trackRef.current;
    const slideElements = Array.from(track.children);
    if (slideElements.length === 0) {
      return;
    }
    const currentElement =
      slideElements.find((slideElement) => slideElement.id === current) ||
      slideElements[0];
    const currentPlace = readPlace(currentElement);
    const focusWasLeaving = slideElements.some(
      (slideElement) =>
        slideElement !== currentElement &&
        slideElement.contains(document.activeElement),
    );
    for (const slideElement of slideElements) {
      const { x, y } = readPlace(slideElement);
      slideElement.style.setProperty(
        "--slide-offset",
        `${x * 100}% ${y * 100}%`,
      );
      const isCurrent = slideElement === currentElement;
      slideElement.toggleAttribute("data-current", isCurrent);
      if (isCurrent) {
        slideElement.removeAttribute("inert");
      }
    }
    track.style.setProperty(
      "--slide-grid-offset",
      `${-currentPlace.x * 100}% ${-currentPlace.y * 100}%`,
    );
    if (focusWasLeaving) {
      findFocusable(currentElement)?.focus({ preventScroll: true });
    }
    for (const slideElement of slideElements) {
      slideElement.toggleAttribute("inert", slideElement !== currentElement);
    }
  });

  /**
   * @returns {HTMLElement|undefined} the slide one step that way, if there is
   *   one. Nothing there means the direction is simply not offered — no
   *   wrapping, no nearest-match: a grid is read as a map, and a move that
   *   lands nowhere would break that reading.
   */
  const slideTowards = (dx, dy) => {
    const track = trackRef.current;
    const slideElements = Array.from(track.children);
    const currentElement =
      slideElements.find((slideElement) =>
        slideElement.hasAttribute("data-current"),
      ) || slideElements[0];
    const { x, y } = readPlace(currentElement);
    return slideElements.find((slideElement) => {
      const place = readPlace(slideElement);
      return place.x === x + dx && place.y === y + dy;
    });
  };
  const move = (dx, dy) => {
    const nextElement = slideTowards(dx, dy);
    if (!nextElement) {
      return false;
    }
    setCurrentState(nextElement.id || undefined);
    if (nextElement.id) {
      onCurrentChange?.(nextElement.id);
    }
    return true;
  };

  const travelled = (moved) => (moved ? false : null);
  const onKeyDownShortcuts = createOnKeyDownForShortcuts({
    arrowright: () => travelled(move(1, 0)),
    arrowleft: () => travelled(move(-1, 0)),
    arrowdown: () => travelled(move(0, 1)),
    arrowup: () => travelled(move(0, -1)),
  });

  return (
    <Box
      {...rest}
      baseClassName="navi_slide_grid"
      data-slide-grid=""
      onnavi_slide_move={(e) => {
        const { dx, dy } = e.detail;
        move(dx, dy);
      }}
      onKeyDown={(e) => {
        onKeyDownShortcuts(e);
        rest.onKeyDown?.(e);
      }}
      style={{ "--slide-grid-duration": duration, ...rest.style }}
    >
      <SlideGridContext.Provider value={{ trackRef }}>
        <div data-slide-track="" ref={trackRef}>
          {children}
        </div>
      </SlideGridContext.Provider>
    </Box>
  );
};

/**
 * @param {object} props
 * @param {number} [props.x=0] - its column, in boxes from the first slide.
 * @param {number} [props.y=0] - its row.
 */
const GridSlide = ({ x = 0, y = 0, children, ...rest }) => (
  <Box flex="y" {...rest} data-slide="" data-slide-x={x} data-slide-y={y}>
    {children}
  </Box>
);

const DIRECTIONS = {
  right: { dx: 1, dy: 0, Svg: ChevronRightSvg, label: "Slide on the right" },
  left: { dx: -1, dy: 0, Svg: ChevronLeftSvg, label: "Slide on the left" },
  down: { dx: 0, dy: 1, Svg: ChevronDownSvg, label: "Slide below" },
  up: { dx: 0, dy: -1, Svg: ChevronUpSvg, label: "Slide above" },
};

/**
 * A way out, pointing where it goes. It says a direction, not a slide: what is
 * over there is the grid's business, and moving a slide changes nothing here.
 *
 * @param {object} props
 * @param {"right"|"left"|"down"|"up"} props.direction
 */
const SlideGridMove = ({ direction, ...rest }) => {
  const { dx, dy, Svg, label } = DIRECTIONS[direction];
  const ref = useRef();
  const context = useContext(SlideGridContext);
  return (
    <Button
      ref={ref}
      icon
      variant="discrete"
      aria-label={label}
      data-slide-nav=""
      {...rest}
      onClick={() => {
        // Straight to the grid rather than through a command: this is an
        // experiment, and --navi-next/--navi-previous have no word for "down".
        context.trackRef.current.parentElement.dispatchEvent(
          new CustomEvent("navi_slide_move", { detail: { dx, dy } }),
        );
      }}
    >
      <Icon lineOverflow="allow">
        <Svg />
      </Icon>
    </Button>
  );
};

SlideGrid.Item = GridSlide;
SlideGrid.Move = SlideGridMove;
