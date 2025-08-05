import { getHeight, getWidth } from "@jsenv/dom";
import { animate, createTransition } from "./animation_playback.js";
import {
  parseTransform,
  stringifyTransform,
} from "./transform_style_parser.js";

export const createHeightAnimation = (element, to, options = {}) => {
  const heightAnimation = animate(
    () => {
      const { from = getHeight(element), ...rest } = options;
      return createTransition({
        ...rest,
        from,
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
    { isVisual: true },
  );
  return heightAnimation;
};
export const createWidthAnimation = (element, to, options = {}) => {
  const widthAnimation = animate(
    () => {
      const { from = getWidth(element), ...rest } = options;
      return createTransition({
        ...rest,
        from,
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
    { isVisual: true },
  );
  return widthAnimation;
};
export const createOpacityAnimation = (element, to, options = {}) => {
  const opacityAnimation = animate(
    () => {
      const { from = getOpacity(element), ...rest } = options;

      return createTransition({
        ...rest,
        from,
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

  const translateXAnimation = animate(
    () => {
      const { from = getTranslateX(element), ...rest } = options;
      return createTransition({
        ...rest,
        from,
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
