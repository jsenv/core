import { getHeight, getWidth, setStyles } from "@jsenv/dom";
import { animate, createTransition } from "./animation_playback.js";
import {
  parseTransform,
  stringifyTransform,
} from "./transform_style_parser.js";

export const createHeightAnimation = (element, to, options = {}) => {
  const heightAnimation = animate(
    () => {
      const { from = getHeight(element), ...rest } = options;

      // Warn if the animation difference is too small
      const diff = Math.abs(to - from);
      if (diff === 0) {
        console.warn(
          `Height animation has identical from and to values (${from}px). This animation will have no visual effect.`,
        );
      } else if (diff < 10) {
        console.warn(
          `Height animation difference is very small (${diff}px). Consider if this animation is necessary.`,
        );
      }

      return createTransition({
        ...rest,
        from,
        to,
        setup: () => {
          const heightAtStartFromInlineStyle = element.style.height;
          const restoreWillChange = setStyles(element, {
            "will-change": "height",
          });
          element.setAttribute(`data-height-animated`, "");
          return {
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
      });
    },
    { isVisual: true },
  );
  return heightAnimation;
};
export const createWidthAnimation = (element, to, options = {}) => {
  const widthAnimation = animate(
    () => {
      const { from = getWidth(element), ...rest } = options;

      // Warn if the animation difference is too small
      const diff = Math.abs(to - from);
      if (diff === 0) {
        console.warn(
          `Width animation has identical from and to values (${from}px). This animation will have no visual effect.`,
        );
      } else if (diff < 10) {
        console.warn(
          `Width animation difference is very small (${diff}px). Consider if this animation is necessary.`,
        );
      }

      return createTransition({
        ...rest,
        from,
        to,
        setup: () => {
          const widthAtStartFromInlineStyle = element.style.width;
          const restoreWillChange = setStyles(element, {
            "will-change": "width",
          });
          element.setAttribute(`data-width-animated`, "");
          return {
            update: (value) => {
              element.style.width = `${value}px`;
            },
            teardown: () => {
              restoreWillChange();
              element.removeAttribute(`data-width-animated`);
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
      });
    },
    { isVisual: true },
  );
  return widthAnimation;
};
export const createOpacityAnimation = (element, to, options = {}) => {
  const opacityAnimation = animate(
    () => {
      const { from = getOpacity(element), ...rest } = options;

      // Warn if the animation difference is too small
      const diff = Math.abs(to - from);
      if (diff === 0) {
        console.warn(
          `Opacity animation has identical from and to values (${from}). This animation will have no visual effect.`,
        );
      } else if (diff < 0.1) {
        console.warn(
          `Opacity animation difference is very small (${diff}). Consider if this animation is necessary.`,
        );
      }

      return createTransition({
        ...rest,
        from,
        to,
        setup: () => {
          const opacityAtStartFromInlineStyle = element.style.opacity;
          const restoreWillChange = setStyles(element, {
            "will-change": "opacity",
          });
          element.setAttribute(`data-opacity-animated`, "");
          return {
            update: (value) => {
              element.style.opacity = value;
            },
            teardown: () => {
              restoreWillChange();
              element.removeAttribute(`data-opacity-animated`);
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
      });
    },
    { isVisual: true },
  );
  return opacityAnimation;
};
const getOpacity = (element) => {
  return parseFloat(getComputedStyle(element).opacity) || 0;
};

export const createTranslateXAnimation = (element, to, options = {}) => {
  const match = to.match(/translateX\(([-\d.]+)(%|px)?\)/);
  if (!match) {
    throw new Error(
      `Invalid to value for translateX transition: ${to}. Expected format: translateX(value[px|%])`,
    );
  }
  const unit = match[2] || "px";
  const toValue = parseFloat(match[1]);

  const translateXAnimation = animate(
    () => {
      const { from = getTranslateX(element), ...rest } = options;

      // Warn if the animation difference is too small
      const diff = Math.abs(toValue - from);
      if (diff === 0) {
        console.warn(
          `TranslateX animation has identical from and to values (${from}${unit}). This animation will have no visual effect.`,
        );
      } else if (diff < 10) {
        console.warn(
          `TranslateX animation difference is very small (${diff}${unit}). Consider if this animation is necessary.`,
        );
      }

      return createTransition({
        ...rest,
        from,
        to,
        setup: () => {
          const transformAtStartFromInlineStyle = element.style.transform;
          const restoreWillChange = setStyles(element, {
            "will-change": "transform",
          });
          element.setAttribute(`data-translate-x-animated`, "");
          return {
            update: (value) => {
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
      });
    },
    { isVisual: true },
  );
  return translateXAnimation;
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
