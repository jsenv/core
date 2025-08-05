import { getHeight, getWidth } from "@jsenv/dom";
import { createAnimatedValue } from "./animated_value.js";
import {
  parseTransform,
  stringifyTransform,
} from "./transform_style_parser.js";

export const createElementHeightTransition = (
  element,
  to,
  { onStart, onUpdate, onCancel, ...options },
) => {
  const from = getHeight(element);
  let heightAtStartFromInlineStyle;

  return createAnimatedValue(from, to, {
    constructor: createElementHeightTransition,
    ...options,
    onStart: () => {
      heightAtStartFromInlineStyle = element.style.height;
      element.setAttribute(`data-height-animated`, "");
      onStart?.();
      return () => {
        element.removeAttribute(`data-height-animated`);
      };
    },
    onUpdate: (updateInfo) => {
      const { value } = updateInfo;
      element.style.height = `${value}px`;
      onUpdate?.(updateInfo);
    },
    onCancel: () => {
      if (heightAtStartFromInlineStyle) {
        element.style.height = heightAtStartFromInlineStyle;
      } else {
        element.style.removeProperty("height");
      }
      onCancel?.();
    },
  });
};
export const createElementWidthTransition = (
  element,
  to,
  { onStart, onUpdate, onCancel, ...options },
) => {
  const from = getWidth(element);
  let widthAtStartFromInlineStyle;

  return createAnimatedValue(from, to, {
    constructor: createElementWidthTransition,
    ...options,
    onStart: () => {
      widthAtStartFromInlineStyle = element.style.width;
      element.setAttribute(`data-width-animated`, "");
      onStart?.();
      return () => {
        element.removeAttribute(`data-width-animated`);
      };
    },
    onUpdate: (updateInfo) => {
      const { value } = updateInfo;
      element.style.height = `${value}px`;
      onUpdate?.(updateInfo);
    },
    onCancel: () => {
      if (widthAtStartFromInlineStyle) {
        element.style.width = widthAtStartFromInlineStyle;
      } else {
        element.style.removeProperty("width");
      }
      onCancel?.();
    },
  });
};
export const createElementOpacityTransition = (
  element,
  to,
  { onStart, onUpdate, onCancel, ...options } = {},
) => {
  const from = parseFloat(getComputedStyle(element).opacity) || 0;
  let opacityAtStartFromInlineStyle;

  return createAnimatedValue(from, to, {
    constructor: createElementOpacityTransition,
    options,
    onStart: () => {
      opacityAtStartFromInlineStyle = element.style.opacity;
      element.setAttribute(`data-opacity-animated`, "");
      onStart?.();
      return () => {
        element.removeAttribute(`data-opacity-animated`);
      };
    },
    onUpdate: (updateInfo) => {
      const { value } = updateInfo;
      element.style.opacity = value;
      onUpdate?.(updateInfo);
    },
    onCancel: () => {
      if (opacityAtStartFromInlineStyle) {
        element.style.opacity = opacityAtStartFromInlineStyle;
      } else {
        element.style.removeProperty("opacity");
      }
      onCancel?.();
    },
  });
};
export const createElementTranslateXTransition = (
  element,
  to,
  { onStart, onCancel, onUpdate, ...options } = {},
) => {
  const match = to.match(/translateX\(([-\d.]+)(%|px)?\)/);
  if (!match) {
    throw new Error(
      `Invalid to value for translateX transition: ${to}. Expected format: translateX(value[px|%])`,
    );
  }
  const unit = match[2] || "px";
  const from = getTranslateX(element);
  let transformAtStartFromInlineStyle;

  return createAnimatedValue(from, to, {
    constructor: createElementTranslateXTransition,
    ...options,
    onStart: () => {
      transformAtStartFromInlineStyle = element.style.transform;
      element.setAttribute(`data-translate-x-animated`, "");
      onStart?.();
      return () => {
        element.removeAttribute(`data-translate-x-animated`);
      };
    },
    onUpdate: (updateInfo) => {
      const { value } = updateInfo;
      setTranslateX(element, value, { unit });
      onUpdate?.(updateInfo);
    },
    onCancel: () => {
      if (transformAtStartFromInlineStyle) {
        element.style.transform = transformAtStartFromInlineStyle;
      } else {
        element.style.removeProperty("transform");
      }
      onCancel?.();
    },
  });
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
