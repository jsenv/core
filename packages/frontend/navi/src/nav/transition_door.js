/**
 * The element a movement opens from: the door pressed to start the navigation,
 * handed to a movement of the application's own as a rectangle in the
 * coordinates of the picture it animates — a page growing out of the button
 * that opened it, and closing back into it on the way back.
 *
 * Measured by navi rather than by the application because navi holds the
 * three things the rectangle depends on: which element the press came from
 * (the navigation announces it, see before_routing.js), where each picture is
 * drawn (transition_window.js), and the crossing a traversal retraces (see
 * route_transition.jsx), which is how the way back — and a browser forward, or
 * a back after a reload — finds a door nobody is pressing.
 *
 * The rectangle is stored in the coordinates of what holds the door: the
 * page's own box when the door is in the pages (its place in the page, which
 * scrolling the page carries along), the screen when it is in the furniture (a
 * "+" in a tab bar stays where it stands). It is turned into the picture's
 * coordinates on ::view-transition, by calc() over the window's own values, so
 * that it follows the pictures frame after frame the way they are placed:
 * the page holding the door is the page being left on a way in, the page
 * arriving on a way back.
 */

import {
  removeTransitionValue,
  setTransitionValue,
} from "./transition_values.js";

// Worn by what the eye takes for the door when it is not the pressed element
// itself: a pill drawn by a Box inside the <a>, a card a stretched link covers.
const DOOR_ATTRIBUTE = "data-navi-route-transition-door";
const DOOR_SELECTOR = `[${DOOR_ATTRIBUTE}]`;

const DOOR_TOP_PROPERTY = "--navi-route-transition-door-top";
const DOOR_LEFT_PROPERTY = "--navi-route-transition-door-left";
const DOOR_WIDTH_PROPERTY = "--navi-route-transition-door-width";
const DOOR_HEIGHT_PROPERTY = "--navi-route-transition-door-height";
const DOOR_RADIUS_PROPERTY = "--navi-route-transition-door-radius";
const DOOR_PROPERTIES = [
  DOOR_TOP_PROPERTY,
  DOOR_LEFT_PROPERTY,
  DOOR_WIDTH_PROPERTY,
  DOOR_HEIGHT_PROPERTY,
  DOOR_RADIUS_PROPERTY,
];

/**
 * The door of a press, as a plain object a history entry can hold:
 * `{ top, left, width, height, radius, inPage }`. Undefined when the element
 * draws nothing to open from (unmounted, or a box of no size).
 */
export const measureTransitionDoor = (pressElement, areaElement) => {
  const doorElement = doorElementOf(pressElement);
  if (!doorElement.isConnected) {
    return undefined;
  }
  const rect = doorElement.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return undefined;
  }
  const inPage = Boolean(areaElement && areaElement.contains(doorElement));
  const areaRect = inPage ? areaElement.getBoundingClientRect() : null;
  return {
    top: inPage ? rect.top - areaRect.top : rect.top,
    left: inPage ? rect.left - areaRect.left : rect.left,
    width: rect.width,
    height: rect.height,
    radius: readDrawnRadius(doorElement, rect.width, rect.height),
    inPage,
  };
};

// What a history entry hands back, which another document may have written.
export const isTransitionDoor = (value) =>
  Boolean(value) &&
  typeof value.top === "number" &&
  typeof value.left === "number" &&
  typeof value.width === "number" &&
  typeof value.height === "number" &&
  typeof value.radius === "string";

export const holdTransitionDoor = (door, direction) => {
  // The picture opened from the door, or closed back into it, and the page
  // holding the door: on a way back that page is the one arriving.
  const picture = direction === "back" ? "old" : "new";
  const page = direction === "back" ? "new" : "old";
  const pictureOffset = (side, value) => {
    const pictureCorner = `var(--navi-transition-window-${picture}-${side}, 0px)`;
    if (!door.inPage) {
      return `calc(${value}px - ${pictureCorner})`;
    }
    const pageCorner = `var(--navi-transition-window-${page}-${side}, 0px)`;
    return `calc(${value}px + ${pageCorner} - ${pictureCorner})`;
  };
  setTransitionValue(DOOR_TOP_PROPERTY, pictureOffset("top", door.top));
  setTransitionValue(DOOR_LEFT_PROPERTY, pictureOffset("left", door.left));
  setTransitionValue(DOOR_WIDTH_PROPERTY, `${door.width}px`);
  setTransitionValue(DOOR_HEIGHT_PROPERTY, `${door.height}px`);
  setTransitionValue(DOOR_RADIUS_PROPERTY, door.radius);
};

export const releaseTransitionDoor = () => {
  for (const property of DOOR_PROPERTIES) {
    removeTransitionValue(property);
  }
};

// The pressed element unless the shape seen is marked: inside it first (the
// shape drawn for this press), then around it.
const doorElementOf = (pressElement) => {
  const inside = pressElement.querySelector(DOOR_SELECTOR);
  if (inside) {
    return inside;
  }
  const around = pressElement.closest(DOOR_SELECTOR);
  if (around) {
    return around;
  }
  return pressElement;
};

// The corners as the browser draws them, which is not what is written: a pill
// says 999px and draws half its height. Interpolated from what is written, a
// clip would stay a circle for most of the movement. Reduced the way CSS
// reduces radii that overlap (css-backgrounds, "corner overlap"): all of them
// by the one factor that makes each side fit.
const readDrawnRadius = (element, width, height) => {
  const style = getComputedStyle(element);
  const topLeft = readCorner(style.borderTopLeftRadius, width, height);
  const topRight = readCorner(style.borderTopRightRadius, width, height);
  const bottomRight = readCorner(style.borderBottomRightRadius, width, height);
  const bottomLeft = readCorner(style.borderBottomLeftRadius, width, height);
  let factor = 1;
  const fit = (length, radiusSum) => {
    if (radiusSum > 0 && length / radiusSum < factor) {
      factor = length / radiusSum;
    }
  };
  fit(width, topLeft.x + topRight.x);
  fit(width, bottomLeft.x + bottomRight.x);
  fit(height, topLeft.y + bottomLeft.y);
  fit(height, topRight.y + bottomRight.y);
  const corners = [topLeft, topRight, bottomRight, bottomLeft];
  const xs = corners.map((corner) => roundPx(corner.x * factor));
  const ys = corners.map((corner) => roundPx(corner.y * factor));
  const all = [...xs, ...ys];
  if (all.every((value) => value === all[0])) {
    return `${all[0]}px`;
  }
  return `${xs.map(px).join(" ")} / ${ys.map(px).join(" ")}`;
};

// "20px", "50%", or "10px 20%" for an elliptical corner.
const readCorner = (value, width, height) => {
  const [first, second = first] = value.split(" ");
  return {
    x: resolveLength(first, width),
    y: resolveLength(second, height),
  };
};

const resolveLength = (value, percentOf) => {
  const number = parseFloat(value);
  if (Number.isNaN(number)) {
    return 0;
  }
  if (value.endsWith("%")) {
    return (number / 100) * percentOf;
  }
  return number;
};

const roundPx = (value) => Math.round(value * 100) / 100;
const px = (value) => `${value}px`;
