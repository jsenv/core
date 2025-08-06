import { getHeight } from "../size/get_height.js";
import { getWidth } from "../size/get_width.js";
import { addWillChange } from "../style_and_attributes.js";
import {
  parseTransform,
  stringifyTransform,
} from "./transform_style_parser.js";
import { createTimelineTransition } from "./transition_playback.js";

export const createHeightTransition = (element, to, options) => {
  const heightTransition = createTimelineTransition({
    ...options,
    constructor: createHeightTransition,
    key: element,
    to,
    isVisual: true,
    lifecycle: {
      setup: () => {
        const heightAtStartFromInlineStyle = element.style.height;
        const restoreWillChange = addWillChange(element, "height");
        element.setAttribute(`data-height-animated`, "");
        return {
          from: getHeight(element),
          update: (value) => {
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
    isVisual: true,
    lifecycle: {
      setup: () => {
        const widthAtStartFromInlineStyle = element.style.width;
        const restoreWillChange = addWillChange(element, "width");
        element.setAttribute(`data-width-animated`, "");
        return {
          from: getWidth(element),
          update: (value) => {
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
    isVisual: true,
    lifecycle: {
      setup: () => {
        const opacityAtStartFromInlineStyle = element.style.opacity;
        const restoreWillChange = addWillChange(element, "opacity");
        element.setAttribute(`data-opacity-animated`, "");
        return {
          from: getOpacity(element),
          update: (value) => {
            element.style.opacity = value;
          },
          teardown: () => {
            element.removeAttribute(`data-opacity-animated`);
            restoreWillChange();
          },
          restore: () => {
            if (opacityAtStartFromInlineStyle) {
              element.style.opacity = opacityAtStartFromInlineStyle;
            } else {
              element.style.removeProperty("opacity");
            }
          },
        };
      },
    },
  });
  return opacityTransition;
};
const getOpacity = (element) => {
  return parseFloat(getComputedStyle(element).opacity) || 0;
};

export const createTranslateXTransition = (element, to, options = {}) => {
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
    isVisual: true,
    lifecycle: {
      setup: () => {
        const transformAtStartFromInlineStyle = element.style.transform;
        const restoreWillChange = addWillChange(element, "transform");
        element.setAttribute(`data-translate-x-animated`, "");
        return {
          from: getTranslateX(element),
          update: (value) => {
            console.log("set translateX", value);
            setTranslateX(element, value, { unit });
          },
          teardown: () => {
            restoreWillChange();
            element.removeAttribute(`data-translate-x-animated`);
          },
          restore: () => {
            if (transformAtStartFromInlineStyle) {
              element.style.transform = transformAtStartFromInlineStyle;
            } else {
              element.style.removeProperty("transform");
            }
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
const setTranslateX = (element, value, { unit }) => {
  const transform = getComputedStyle(element).transform;
  const transformMap = parseTransform(transform);
  transformMap.set("translateX", { value, unit });
  const transformString = stringifyTransform(transformMap);
  element.style.transform = transformString;
};
