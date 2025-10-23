/**
 * TODO: use style_controller.js
 *
 * - Able to force transition styles
 * - Able to read natural styles (getUnderlyingValue)
 * - Able to getWith/Height/opacity without transition
 *
 */

import { getHeight } from "../size/get_height.js";
import { getWidth } from "../size/get_width.js";
import { addWillChange } from "../style/dom_styles.js";
import { parseTransform } from "./transform_style_parser.js";
import { createTimelineTransition } from "./transition_playback.js";

import.meta.css = /* css */ `
  /* Transition data attributes override inline styles using CSS custom properties */
  *[data-transition-opacity] {
    opacity: var(--ui-transition-opacity) !important;
  }

  *[data-transition-translate-x] {
    transform: translateX(var(--ui-transition-translate-x)) !important;
  }

  *[data-transition-width] {
    width: var(--ui-transition-width) !important;
  }

  *[data-transition-height] {
    height: var(--ui-transition-height) !important;
  }
`;

export const createHeightTransition = (element, to, options) => {
  const heightTransition = createTimelineTransition({
    ...options,
    constructor: createHeightTransition,
    key: element,
    to,
    isVisual: true,
    minDiff: 10,
    lifecycle: {
      setup: () => {
        const restoreWillChange = addWillChange(element, "height");
        return {
          from: getHeight(element),
          update: ({ value }) => {
            const valueWithUnit = `${value}px`;
            element.setAttribute("data-transition-height", valueWithUnit);
            element.style.setProperty("--ui-transition-height", valueWithUnit);
          },
          teardown: () => {
            element.removeAttribute("data-transition-height");
            element.style.removeProperty("--ui-transition-height");
            restoreWillChange();
          },
          restore: () => {
            element.removeAttribute("data-transition-height");
            element.style.removeProperty("--ui-transition-height");
          },
        };
      },
    },
  });
  return heightTransition;
};
export const createWidthTransition = (element, to, options) => {
  const widthTransition = createTimelineTransition({
    ...options,
    constructor: createWidthTransition,
    key: element,
    to,
    minDiff: 10,
    isVisual: true,
    lifecycle: {
      setup: () => {
        const restoreWillChange = addWillChange(element, "width");
        return {
          from: getWidth(element),
          update: ({ value }) => {
            const valueWithUnit = `${value}px`;
            element.setAttribute("data-transition-width", valueWithUnit);
            element.style.setProperty("--ui-transition-width", valueWithUnit);
          },
          teardown: () => {
            element.removeAttribute("data-transition-width");
            element.style.removeProperty("--ui-transition-width");
            restoreWillChange();
          },
          restore: () => {
            element.removeAttribute("data-transition-width");
            element.style.removeProperty("--ui-transition-width");
          },
        };
      },
    },
  });
  return widthTransition;
};
export const createOpacityTransition = (element, to, options = {}) => {
  const opacityTransition = createTimelineTransition({
    ...options,
    constructor: createOpacityTransition,
    key: element,
    to,
    minDiff: 0.1,
    isVisual: true,
    lifecycle: {
      setup: () => {
        const restoreWillChange = addWillChange(element, "opacity");
        return {
          from: getOpacity(element),
          update: ({ value }) => {
            element.setAttribute("data-transition-opacity", value);
            element.style.setProperty("--ui-transition-opacity", value);
          },
          teardown: () => {
            element.removeAttribute("data-transition-opacity");
            element.style.removeProperty("--ui-transition-opacity");
            restoreWillChange();
          },
          restore: () => {
            element.removeAttribute("data-transition-opacity");
            element.style.removeProperty("--ui-transition-opacity");
          },
        };
      },
    },
  });
  return opacityTransition;
};
export const getOpacity = (element) => {
  return parseFloat(getComputedStyle(element).opacity) || 0;
};

export const createTranslateXTransition = (element, to, options) => {
  let unit = "px";
  if (typeof to === "string") {
    if (to.endsWith("%")) {
      unit = "%";
    }
    to = parseFloat(to);
  }

  const translateXTransition = createTimelineTransition({
    ...options,
    constructor: createTranslateXTransition,
    key: element,
    to,
    minDiff: 10,
    isVisual: true,
    lifecycle: {
      setup: () => {
        const restoreWillChange = addWillChange(element, "transform");
        return {
          from: getTranslateX(element),
          update: ({ value }) => {
            const valueWithUnit = `${value}${unit}`;
            element.setAttribute("data-transition-translate-x", valueWithUnit);
            element.style.setProperty(
              "--ui-transition-translate-x",
              valueWithUnit,
            );
          },
          teardown: () => {
            restoreWillChange();
            element.removeAttribute("data-transition-translate-x");
            element.style.removeProperty("--ui-transition-translate-x");
          },
          restore: () => {
            element.removeAttribute("data-transition-translate-x");
            element.style.removeProperty("--ui-transition-translate-x");
          },
        };
      },
    },
  });
  return translateXTransition;
};
export const getTranslateX = (element) => {
  const transform = getComputedStyle(element).transform;
  const transformMap = parseTransform(transform);
  return transformMap.get("translateX")?.value || 0;
};

// Helper functions for getting natural (non-transition) values
export const getOpacityWithoutTransition = (element) => {
  const transitionOpacity = element.getAttribute("data-transition-opacity");

  // Temporarily remove transition attribute
  element.removeAttribute("data-transition-opacity");

  const naturalValue = parseFloat(getComputedStyle(element).opacity) || 0;

  // Restore transition attribute if it existed
  if (transitionOpacity !== null) {
    element.setAttribute("data-transition-opacity", transitionOpacity);
  }

  return naturalValue;
};

export const getTranslateXWithoutTransition = (element) => {
  const transitionTranslateX = element.getAttribute(
    "data-transition-translate-x",
  );

  // Temporarily remove transition attribute
  element.removeAttribute("data-transition-translate-x");

  const transform = getComputedStyle(element).transform;
  const transformMap = parseTransform(transform);
  const naturalValue = transformMap.get("translateX")?.value || 0;

  // Restore transition attribute if it existed
  if (transitionTranslateX !== null) {
    element.setAttribute("data-transition-translate-x", transitionTranslateX);
  }

  return naturalValue;
};

export const getWidthWithoutTransition = (element) => {
  const transitionWidth = element.getAttribute("data-transition-width");

  // Temporarily remove transition attribute
  element.removeAttribute("data-transition-width");

  const naturalValue = getWidth(element);

  // Restore transition attribute if it existed
  if (transitionWidth !== null) {
    element.setAttribute("data-transition-width", transitionWidth);
  }

  return naturalValue;
};

export const getHeightWithoutTransition = (element) => {
  const transitionHeight = element.getAttribute("data-transition-height");

  // Temporarily remove transition attribute
  element.removeAttribute("data-transition-height");

  const naturalValue = getHeight(element);

  // Restore transition attribute if it existed
  if (transitionHeight !== null) {
    element.setAttribute("data-transition-height", transitionHeight);
  }

  return naturalValue;
};
