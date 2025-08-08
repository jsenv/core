import { getHeight } from "../size/get_height.js";
import { getWidth } from "../size/get_width.js";
import { addWillChange } from "../style_and_attributes.js";
import { parseTransform } from "./transform_style_parser.js";
import { createTimelineTransition } from "./transition_playback.js";

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
        const heightAtStartFromInlineStyle = element.style.height;
        const restoreWillChange = addWillChange(element, "height");
        element.setAttribute(`data-height-animated`, "");
        return {
          from: getHeight(element),
          update: ({ value }) => {
            element.style.height = `${value}px`;
          },
          teardown: () => {
            element.removeAttribute(`data-height-animated`);
            restoreWillChange();
          },
          restore: () => {
            if (heightAtStartFromInlineStyle) {
              element.style.height = heightAtStartFromInlineStyle;
            } else {
              element.style.removeProperty("height");
            }
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
        const widthAtStartFromInlineStyle = element.style.width;
        const restoreWillChange = addWillChange(element, "width");
        element.setAttribute(`data-width-animated`, "");
        return {
          from: getWidth(element),
          update: ({ value }) => {
            element.style.width = `${value}px`;
          },
          teardown: () => {
            element.removeAttribute(`data-width-animated`);
            restoreWillChange();
          },
          restore: () => {
            if (widthAtStartFromInlineStyle) {
              element.style.width = widthAtStartFromInlineStyle;
            } else {
              element.style.removeProperty("width");
            }
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
  // Check for transition data attribute first
  const transitionOpacity = element.getAttribute("data-transition-opacity");
  if (transitionOpacity !== null) {
    return parseFloat(transitionOpacity) || 0;
  }
  // Fall back to computed style
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
  // Check for transition data attribute first
  const transitionTranslateX = element.getAttribute(
    "data-transition-translate-x",
  );
  if (transitionTranslateX !== null) {
    return parseFloat(transitionTranslateX) || 0;
  }
  // Fall back to computed transform
  const transform = getComputedStyle(element).transform;
  const transformMap = parseTransform(transform);
  return transformMap.get("translateX")?.value || 0;
};
