import { getHeight, getWidth } from "@jsenv/dom";
import { animate, createTransition } from "./animation_playback.js";
import {
  parseTransform,
  stringifyTransform,
} from "./transform_style_parser.js";

export const createHeightAnimation = (element, options) => {
  const heightAnimation = animate(
    (to) => {
      return createTransition({
        from: getHeight(element),
        to,
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
        effect: (value) => {
          element.style.height = `${value}px`;
        },
      });
    },
    { isVisual: true, ...options },
  );
  return heightAnimation;
};
export const createWidthAnimation = (element, options) => {
  const widthAnimation = animate(
    (to) => {
      return createTransition({
        from: getWidth(element),
        to,
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
        effect: (value) => {
          element.style.width = `${value}px`;
        },
      });
    },
    {
      isVisual: true,
      ...options,
    },
  );
  return widthAnimation;
};
export const createOpacityAnimation = (element, options) => {
  const opacityAnimation = animate(
    (to) => {
      return createTransition({
        from: parseFloat(getComputedStyle(element).opacity) || 0,
        to,
        init: () => {
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
        effect: (value) => {
          element.style.opacity = value;
        },
      });
    },
    { isVisual: true, ...options },
  );
  return opacityAnimation;
};
export const createTranslateXAnimation = (element, options) => {
  const translateXAnimation = animate(
    (to) => {
      const match = to.match(/translateX\(([-\d.]+)(%|px)?\)/);
      if (!match) {
        throw new Error(
          `Invalid to value for translateX transition: ${to}. Expected format: translateX(value[px|%])`,
        );
      }
      const unit = match[2] || "px";

      return createTransition({
        from: getTranslateX(element),
        to,
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
        effect: (value) => {
          setTranslateX(element, value, { unit });
        },
      });
    },
    { isVisual: true, ...options },
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
