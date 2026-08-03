/**
 * EXPERIMENT — what a slide list becomes when the slides are not in a line.
 *
 * A list only knows "before" and "after", which forces every screen into one
 * order: pick → create → edit, where edit is really beside pick, not after
 * create. Saying WHERE each screen is says what they actually are — one below,
 * one to the right — and the travel then goes where the eye expects.
 *
 * `layout` is where that is said, and it takes either a word or a map:
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
 * because a grid without names says nothing — the map IS the grid.
 *
 * Everything else is slide_list.jsx's: the slides sit in one cell each (so the
 * box is as big as the largest of them), the track is the only thing that moves
 * (one transition, no seam), and whatever is not on screen is inert.
 *
 * If this holds up, SlideList is layout="row" and disappears into it.
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
  .navi_slide_container {
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
      translate: var(--slide-container-offset, 0);
      transition: translate var(--slide-container-duration, 300ms) ease;

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

const SlideContainerContext = createContext(null);

/**
 * The map, as cells: ["pick edit", "create ."] becomes a lookup from a place to
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
        }
      }
      x++;
    }
    y++;
  }
  return { areaAt, placeOf };
};

// "row"/"column": the slides follow one another in the order they are written,
// which is the map one would have drawn by hand — so it is drawn here, and
// everything downstream only ever knows about maps.
const placeInALine = (slideElements, layout) => {
  const names = slideElements.map(
    (slideElement) =>
      slideElement.getAttribute("data-slide-area") || slideElement.id,
  );
  return parseAreas(layout === "column" ? names : [names.join(" ")]);
};

const readArea = (slideElement) =>
  slideElement.getAttribute("data-slide-area") || slideElement.id;

/**
 * @param {object} props
 * @param {"row"|"column"|string[]} [props.layout="row"] - where the slides
 *   are. A word for a line — "row" to the right, "column" downwards, both in
 *   DOM order — or a map of named areas, one string per row:
 *   `["pick edit", "create"]`. The map is spelled like grid-template-areas
 *   ("." is a hole, a name repeated spans), except that a row needs no
 *   trailing hole: what is not written is simply not there.
 * @param {string} [props.current] - area of the slide on screen.
 * @param {(area: string) => void} [props.onCurrentChange]
 * @param {string} [props.duration="300ms"]
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
  const [currentState, setCurrentState] = useState(undefined);
  const current = currentProp ?? currentState;

  const readMap = () => {
    const slideElements = Array.from(trackRef.current.children);
    const map =
      typeof layout === "string"
        ? placeInALine(slideElements, layout)
        : parseAreas(layout);
    return { slideElements, ...map };
  };

  useLayoutEffect(() => {
    const { slideElements, placeOf } = readMap();
    if (slideElements.length === 0) {
      return;
    }
    const currentElement =
      slideElements.find(
        (slideElement) => readArea(slideElement) === current,
      ) || slideElements[0];
    const currentPlace = placeOf.get(readArea(currentElement)) || {
      x: 0,
      y: 0,
    };
    const focusWasLeaving = slideElements.some(
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
      if (isCurrent) {
        slideElement.removeAttribute("inert");
      }
    }
    trackRef.current.style.setProperty(
      "--slide-container-offset",
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
    const place = placeOf.get(currentArea) || { x: 0, y: 0 };
    let { x, y } = place;
    while (true) {
      x += dx;
      y += dy;
      const area = areaAt.get(`${x},${y}`);
      if (area === currentArea) {
        continue;
      }
      return area;
    }
  };
  const move = (dx, dy) => {
    const area = areaTowards(dx, dy);
    if (!area) {
      return false;
    }
    setCurrentState(area);
    onCurrentChange?.(area);
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
      baseClassName="navi_slide_container"
      data-slide-container=""
      onnavi_slide_move={(e) => {
        const { dx, dy } = e.detail;
        move(dx, dy);
      }}
      onKeyDown={(e) => {
        onKeyDownShortcuts(e);
        rest.onKeyDown?.(e);
      }}
      style={{ "--slide-container-duration": duration, ...rest.style }}
    >
      <SlideContainerContext.Provider value={{ trackRef }}>
        <div data-slide-track="" ref={trackRef}>
          {children}
        </div>
      </SlideContainerContext.Provider>
    </Box>
  );
};

/**
 * @param {object} props
 * @param {string} [props.area] - which area of the map it is. Defaults to its
 *   id, so a slide that is already named does not have to be named twice.
 */
const ContainerSlide = ({ area, children, ...rest }) => (
  <Box flex="y" {...rest} data-slide="" data-slide-area={area ?? rest.id}>
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
const SlideContainerMove = ({ direction, ...rest }) => {
  const { dx, dy, Svg, label } = DIRECTIONS[direction];
  const ref = useRef();
  const context = useContext(SlideContainerContext);
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

SlideContainer.Item = ContainerSlide;
SlideContainer.Move = SlideContainerMove;
