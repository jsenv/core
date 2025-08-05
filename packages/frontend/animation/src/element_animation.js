import { getHeight, getWidth } from "@jsenv/dom";
import { createAnimatedValue } from "./animated_value.js";
import {
  parseTransform,
  stringifyTransform,
} from "./transform_style_parser.js";

export const createElementHeightTransition = (element, to, options) => {
  const from = getHeight(element);
  const animatedHeight = createAnimatedValue(from, to, {
    ...options,
    init: () => {
      const heightAtStartFromInlineStyle = element.style.height;
      element.setAttribute(`data-height-animated`, "");
      return () => {
        element.removeAttribute(`data-height-animated`);
        if (heightAtStartFromInlineStyle) {
          element.style.height = heightAtStartFromInlineStyle;
        } else {
          element.style.removeProperty("height");
        }
      };
    },
  });
  animatedHeight.progressCallbacks.add(() => {
    const { value } = animatedHeight;
    element.style.height = `${value}px`;
  });
  return animatedHeight;
};
export const createElementWidthTransition = (element, to, options) => {
  const from = getWidth(element);
  const animatedWidth = createAnimatedValue(from, to, {
    ...options,
    init: () => {
      const widthAtStartFromInlineStyle = element.style.width;
      element.setAttribute(`data-width-animated`, "");

      return () => {
        element.removeAttribute(`data-width-animated`);
        if (widthAtStartFromInlineStyle) {
          element.style.width = widthAtStartFromInlineStyle;
        } else {
          element.style.removeProperty("width");
        }
      };
    },
  });
  animatedWidth.progressCallbacks.add(() => {
    const { value } = animatedWidth;
    element.style.height = `${value}px`;
  });
  return animatedWidth;
};
export const createElementOpacityTransition = (element, to, options) => {
  const from = parseFloat(getComputedStyle(element).opacity) || 0;
  const animatedOpacity = createAnimatedValue(from, to, {
    ...options,
    onStart: () => {
      const opacityAtStartFromInlineStyle = element.style.opacity;
      element.setAttribute(`data-opacity-animated`, "");
      return () => {
        element.removeAttribute(`data-opacity-animated`);
        if (opacityAtStartFromInlineStyle) {
          element.style.opacity = opacityAtStartFromInlineStyle;
        } else {
          element.style.removeProperty("opacity");
        }
      };
    },
  });
  animatedOpacity.progressCallbacks.add(() => {
    const { value } = animatedOpacity;
    element.style.opacity = value;
  });
  return animatedOpacity;
};
export const createElementTranslateXTransition = (element, to, options) => {
  const match = to.match(/translateX\(([-\d.]+)(%|px)?\)/);
  if (!match) {
    throw new Error(
      `Invalid to value for translateX transition: ${to}. Expected format: translateX(value[px|%])`,
    );
  }
  const unit = match[2] || "px";
  const from = getTranslateX(element);
  const animatedTranslateX = createAnimatedValue(from, to, {
    constructor: createElementTranslateXTransition,
    ...options,
    init: () => {
      const transformAtStartFromInlineStyle = element.style.transform;
      element.setAttribute(`data-translate-x-animated`, "");
      return () => {
        if (transformAtStartFromInlineStyle) {
          element.style.transform = transformAtStartFromInlineStyle;
        } else {
          element.style.removeProperty("transform");
        }
        element.removeAttribute(`data-translate-x-animated`);
      };
    },
  });
  animatedTranslateX.progressCallbacks.add(() => {
    const { value } = animatedTranslateX;
    setTranslateX(element, value, { unit });
  });
  return animatedTranslateX;
};
const getTranslateX = (element) => {
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
