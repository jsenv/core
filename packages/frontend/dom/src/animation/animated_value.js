import { cubicBezier } from "@jsenv/animation";
import { getHeight } from "../size/get_height.js";
import { getWidth } from "../size/get_width.js";
import { addOnTimeline, removeFromTimeline } from "./animation_engine.js";
import {
  parseTransform,
  stringifyTransform,
} from "./transform_style_parser.js";

const easingDefault = (x) => cubicBezier(x, 0.1, 0.4, 0.6, 1.0);

export const createAnimatedValue = (
  from,
  to,
  {
    duration,
    easing = easingDefault,
    onStart,
    onUpdate,
    onCancel,
    onFinish,
  } = {},
) => {
  const animatedValue = {
    from,
    to,
    duration,
    value: from,
    easing,
    paused: true,
    ended: false,
    play: () => {
      if (!animatedValue.paused) {
        return;
      }
      animatedValue.paused = false;
      addOnTimeline(animatedValue);
    },
    pause: () => {
      if (animatedValue.paused) {
        return;
      }
      animatedValue.paused = true;
      removeFromTimeline(animatedValue);
    },
    startTime: null,
    currentTime: null,
    onStart,
    onUpdate: (value, { timing }) => {
      animatedValue.value = value;
      onUpdate?.(value, { timing });
    },
    onCancel,
    onFinish: () => {
      animatedValue.ended = true;
      onFinish?.();
    },
  };
  return animatedValue;
};

export const createElementHeightTransition = (
  element,
  to,
  { duration, easing, onFinish },
) => {
  const from = getHeight(element);
  let heightAtStartFromInlineStyle;

  return createAnimatedValue(from, to, {
    duration,
    easing,
    onStart: () => {
      heightAtStartFromInlineStyle = element.style.height;
      element.setAttribute(`data-height-animated`, "");
      return () => {
        element.removeAttribute(`data-height-animated`);
      };
    },
    onUpdate: (value) => {
      element.style.height = `${value}px`;
    },
    onCancel: () => {
      if (heightAtStartFromInlineStyle) {
        element.style.height = heightAtStartFromInlineStyle;
      } else {
        element.style.removeProperty("height");
      }
    },
    onFinish,
  });
};
export const createElementWidthTransition = (
  element,
  to,
  { duration, easing, onFinish },
) => {
  const from = getWidth(element);
  let widthAtStartFromInlineStyle;

  return createAnimatedValue(from, to, {
    duration,
    easing,
    onStart: () => {
      widthAtStartFromInlineStyle = element.style.width;
      element.setAttribute(`data-width-animated`, "");
      return () => {
        element.removeAttribute(`data-width-animated`);
      };
    },
    onUpdate: (value) => {
      element.style.height = `${value}px`;
    },
    onCancel: () => {
      if (widthAtStartFromInlineStyle) {
        element.style.width = widthAtStartFromInlineStyle;
      } else {
        element.style.removeProperty("width");
      }
    },
    onFinish,
  });
};
export const createElementOpacityTransition = (
  element,
  to,
  { duration, easing, onFinish } = {},
) => {
  const from = parseFloat(getComputedStyle(element).opacity) || 0;
  let opacityAtStartFromInlineStyle;

  return createAnimatedValue(from, to, {
    duration,
    easing,
    onStart: () => {
      opacityAtStartFromInlineStyle = element.style.opacity;
      element.setAttribute(`data-opacity-animated`, "");
      return () => {
        element.removeAttribute(`data-opacity-animated`);
      };
    },
    onUpdate: (value) => {
      element.style.opacity = value;
    },
    onCancel: () => {
      if (opacityAtStartFromInlineStyle) {
        element.style.opacity = opacityAtStartFromInlineStyle;
      } else {
        element.style.removeProperty("opacity");
      }
    },
    onFinish,
  });
};
export const createElementTranslateXTransition = (
  element,
  to,
  { duration, easing, onFinish } = {},
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
    duration,
    easing,
    onStart: () => {
      transformAtStartFromInlineStyle = element.style.transform;
      element.setAttribute(`data-translate-x-animated`, "");
      return () => {
        element.removeAttribute(`data-translate-x-animated`);
      };
    },
    onUpdate: (value) => {
      setTranslateX(element, value, { unit });
    },
    onCancel: () => {
      if (transformAtStartFromInlineStyle) {
        element.style.transform = transformAtStartFromInlineStyle;
      } else {
        element.style.removeProperty("transform");
      }
    },
    onFinish,
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
