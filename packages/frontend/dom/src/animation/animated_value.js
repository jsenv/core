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
    progress: 0,
    paused: true,
    ended: false,
    playing: false,
    play: () => {
      if (!animatedValue.paused) {
        return;
      }
      animatedValue.paused = false;
      animatedValue.playing = true;
      addOnTimeline(animatedValue);
    },
    pause: () => {
      if (animatedValue.paused) {
        return;
      }
      animatedValue.paused = true;
      animatedValue.playing = false;
      removeFromTimeline(animatedValue);
    },
    startTime: null,
    currentTime: null,
    onStart,
    update: ({ progress, value, timing }) => {
      animatedValue.progress = progress;
      animatedValue.value = value;
      onUpdate?.({ progress, value, timing });
    },
    onCancel,
    onFinish: () => {
      animatedValue.playing = false;
      animatedValue.ended = true;
      animatedValue.onfinish?.();
      onFinish?.();
    },
  };
  return animatedValue;
};

export const playAnimations = (animations, { onEnd }) => {
  const animationWrapper = {
    playing: true,
    paused: false,
    ended: false,
    cancel: () => {
      for (const animation of animations) {
        animation.onCancel?.();
        removeFromTimeline(animation);
      }
    },
    getAnimationByConstructor: (constructor) => {
      return animations.find(
        (animation) => animation.constructor === constructor,
      );
    },
  };

  let animationPlayingCount = animations.length;
  for (const animation of animations) {
    // eslint-disable-next-line no-loop-func
    animation.onfinish = () => {
      animationPlayingCount--;
      if (animationPlayingCount === 0) {
        animationWrapper.playing = false;
        animationWrapper.ended = true;
        onEnd?.();
      }
    };
    animation.play();
  }

  return animationWrapper;
};

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
