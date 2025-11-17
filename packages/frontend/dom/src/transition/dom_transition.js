import {
  areSameRGBA,
  stringifyCSSColor,
  updateRGBA,
} from "../color/color_parsing.js";
import { resolveCSSColor } from "../color/resolve_css_color.js";
import { normalizeStyle } from "../style/parsing/style_parsing.js";
import {
  createStyleController,
  getBackground,
  getBackgroundColor,
  getHeight,
  getOpacity,
  getTranslateX,
  getWidth,
} from "../style/style_controller.js";
import {
  applyTransitionProgress,
  combineTwoLifecycle,
  createTimelineTransition,
} from "./transition_playback.js";

const transitionStyleController = createStyleController("transition");

/**
 * Helper function to create CSS property transitions with common configuration
 * @param {Object} config - Configuration object
 * @param {Function} config.constructor - Constructor function for the transition
 * @param {HTMLElement} config.element - DOM element to animate
 * @param {number} config.to - Target value
 * @param {Function} config.getFrom - Function to get current property value
 * @param {string|Object} config.styleProperty - CSS property name or style object path
 * @param {number} [config.minDiff] - Minimum difference threshold for the transition
 * @param {Object} [config.options={}] - Additional options
 * @param {string} [config.options.styleSynchronizer="js_animation"] - How to apply transition ("js_animation", "inline_style", or "--css-var-name")
 * @returns {Object} Timeline transition object
 */
const createCSSPropertyTransition = ({
  element,
  getFrom,
  styleProperty,
  styleSynchronizer = "js_animation",
  getValue = (t) => t.value,
  lifecycle,
  ...options
}) => {
  if (typeof styleSynchronizer !== "string") {
    throw new Error("styleSynchronizer must be a string");
  }
  const setupSynchronizer = () => {
    if (styleSynchronizer === "inline_style") {
      return {
        update: (transition) => {
          const value = getValue(transition);
          if (typeof styleProperty === "string") {
            // Special handling for different CSS properties
            if (styleProperty === "opacity") {
              element.style[styleProperty] = value;
            } else {
              element.style[styleProperty] =
                typeof value === "number" ? `${value}px` : value;
            }
          } else {
            // Handle complex properties like transform.translateX
            const keys = styleProperty.split(".");
            if (keys[0] === "transform") {
              element.style.transform = `${keys[1]}(${value}px)`;
            }
          }
        },
        restore: () => {
          if (typeof styleProperty === "string") {
            element.style[styleProperty] = "";
          } else {
            const keys = styleProperty.split(".");
            if (keys[0] === "transform") {
              element.style.transform = "";
            }
          }
        },
      };
    }
    if (styleSynchronizer.startsWith("--")) {
      return {
        update: (transition) => {
          const value = getValue(transition);
          // Special handling for different CSS properties
          if (styleProperty === "opacity") {
            element.style.setProperty(styleSynchronizer, value);
          } else {
            element.style.setProperty(
              styleSynchronizer,
              typeof value === "number" ? `${value}px` : value,
            );
          }
        },
        restore: () => {
          element.style.removeProperty(styleSynchronizer);
        },
      };
    }
    if (styleSynchronizer.startsWith("[")) {
      const attributeName = styleSynchronizer.slice(1, -1);
      return {
        update: (transition) => {
          const value = getValue(transition);
          element.setAttribute(attributeName, value);
        },
        restore: () => {
          element.removeAttribute(attributeName);
        },
      };
    }
    return {
      update: (transition) => {
        const value = getValue(transition);

        if (typeof styleProperty === "string") {
          transitionStyleController.set(element, { [styleProperty]: value });
        } else {
          // Handle nested properties like transform.translateX
          const styleObj = {};
          const keys = styleProperty.split(".");
          if (keys.length === 2) {
            styleObj[keys[0]] = { [keys[1]]: value };
          }
          transitionStyleController.set(element, styleObj);
        }
      },
      restore: () => {
        transitionStyleController.delete(element, styleProperty);
      },
    };
  };

  return createTimelineTransition({
    duration: 300,
    ...options,
    key: element,
    isVisual: true,
    lifecycle: combineTwoLifecycle(
      {
        setup: () => {
          const from = getFrom(element);
          const synchronizer = setupSynchronizer();
          return {
            from,
            update: synchronizer.update,
            restore: synchronizer.restore,
          };
        },
      },
      lifecycle,
    ),
  });
};
const createNoopCSSPropertyTransition = ({ element, ...options }) => {
  return createTimelineTransition({
    duration: 300,
    ...options,
    key: element,
    isVisual: true,
    from: 0,
    to: 1,
  });
};
const createInstantCSSPropertyTransition = ({ element, value, ...options }) => {
  return createCSSPropertyTransition({
    ...options,
    element,
    getFrom: () => 0,
    from: 0,
    to: 1,
    getValue: () => value,
  });
};

export const createHeightTransition = (element, to, options = {}) => {
  return createCSSPropertyTransition({
    ...options,
    constructor: createHeightTransition,
    element,
    styleProperty: "height",
    getFrom: getHeight,
    to,
    minDiff: 10,
  });
};
export const createWidthTransition = (element, to, options = {}) => {
  return createCSSPropertyTransition({
    ...options,
    constructor: createWidthTransition,
    element,
    styleProperty: "width",
    getFrom: getWidth,
    to,
    minDiff: 10,
  });
};
export const createOpacityTransition = (element, to, options = {}) => {
  return createCSSPropertyTransition({
    ...options,
    constructor: createOpacityTransition,
    element,
    styleProperty: "opacity",
    getFrom: getOpacity,
    to,
    minDiff: 0.1,
  });
};
export const createTranslateXTransition = (element, to, options = {}) => {
  return createCSSPropertyTransition({
    ...options,
    constructor: createTranslateXTransition,
    element,
    styleProperty: "transform.translateX",
    getFrom: getTranslateX,
    to,
    minDiff: 10,
  });
};
export const createBackgroundColorTransition = (element, to, options = {}) => {
  const fromBackgroundColor = options.from || getBackgroundColor(element);
  const toBackgroundColor = resolveCSSColor(to, element);
  const fromUnset = !fromBackgroundColor;
  const toUnset = !toBackgroundColor;

  if (fromUnset && toUnset) {
    return createNoopCSSPropertyTransition(element);
  }

  const innerCreateBackgroundTransition = (fromColor, toColor) => {
    if (areSameRGBA(fromColor, toColor)) {
      return createNoopCSSPropertyTransition(element);
    }

    const [rFrom, gFrom, bFrom, aFrom] = fromColor;
    const [rTo, gTo, bTo, aTo] = toColor;

    return createCSSPropertyTransition({
      ...options,
      constructor: createBackgroundColorTransition,
      element,
      styleProperty: "backgroundColor",
      getFrom: () => 0,
      from: 0,
      to: 1,
      getValue: (transition) => {
        const r = applyTransitionProgress(transition, rFrom, rTo);
        const g = applyTransitionProgress(transition, gFrom, gTo);
        const b = applyTransitionProgress(transition, bFrom, bTo);
        const a = applyTransitionProgress(transition, aFrom, aTo);
        return stringifyCSSColor([r, g, b, a]);
      },
    });
  };
  if (fromUnset) {
    const toFullyTransparent = updateRGBA(toBackgroundColor, { a: 0 });
    return innerCreateBackgroundTransition(
      toFullyTransparent,
      toBackgroundColor,
    );
  }
  if (toUnset) {
    const fromFullyTransparent = updateRGBA(fromBackgroundColor, { a: 0 });
    return innerCreateBackgroundTransition(
      fromBackgroundColor,
      fromFullyTransparent,
    );
  }
  const fromFullyTransparent = fromBackgroundColor[3] === 0;
  const toFullyTransparent = toBackgroundColor[3] === 0;
  if (fromFullyTransparent && toFullyTransparent) {
    return createNoopCSSPropertyTransition(element);
  }
  if (fromFullyTransparent) {
    const toFullTransparent = updateRGBA(toBackgroundColor, { a: 0 });
    return innerCreateBackgroundTransition(
      toFullTransparent,
      toBackgroundColor,
    );
  }
  if (toFullyTransparent) {
    const fromFullyTransparent = updateRGBA(fromBackgroundColor, { a: 0 });
    return innerCreateBackgroundTransition(
      fromBackgroundColor,
      fromFullyTransparent,
    );
  }
  return innerCreateBackgroundTransition(
    fromBackgroundColor,
    toBackgroundColor,
  );
};
export const createBackgroundTransition = (element, to, options = {}) => {
  const fromBackground = options.from || getBackground(element);
  const toBackground = normalizeStyle(to, "background", "js", element);

  // Handle simple cases where no transition is possible
  if (!fromBackground && !toBackground) {
    return createNoopCSSPropertyTransition({ element, ...options });
  }

  // If either is not an object (complex case), fall back to instant change
  if (
    typeof fromBackground !== "object" ||
    typeof toBackground !== "object" ||
    Array.isArray(fromBackground) ||
    Array.isArray(toBackground)
  ) {
    return createInstantCSSPropertyTransition({
      element,
      styleProperty: "background",
      value: normalizeStyle(toBackground, "background", "css"),
    });
  }

  // Try to transition between compatible backgrounds
  const canTransition = canTransitionBackgrounds(fromBackground, toBackground);
  if (!canTransition) {
    return createInstantCSSPropertyTransition({
      element,
      styleProperty: "background",
      value: normalizeStyle(toBackground, "background", "css"),
    });
  }

  // If only colors are different, use color transition
  if (onlyColorsDiffer(fromBackground, toBackground)) {
    return createBackgroundColorTransition(element, toBackground.color, {
      ...options,
      from: fromBackground.color,
    });
  }

  // Complex transition between compatible backgrounds
  return createCSSPropertyTransition({
    ...options,
    element,
    styleProperty: "background",
    getFrom: () => 0,
    from: 0,
    to: 1,
    getValue: (transition) => {
      const progress = transition.value;
      const interpolated = interpolateBackgrounds(
        fromBackground,
        toBackground,
        progress,
      );
      return normalizeStyle(interpolated, "background", "css");
    },
  });
};

// Helper function to check if backgrounds can be transitioned
const canTransitionBackgrounds = (from, to) => {
  // Can transition if both have colors and similar structure
  if (from.color && to.color) {
    // Same image/pattern structure allows transition
    const fromImage = from.image || "none";
    const toImage = to.image || "none";
    // Allow transition if images are the same or both are "none"
    if (fromImage === toImage) {
      return true;
    }
    // Allow transition between gradients of the same type
    if (isGradient(fromImage) && isGradient(toImage)) {
      return getGradientType(fromImage) === getGradientType(toImage);
    }
  }
  return false;
};

// Helper function to check if only colors differ
const onlyColorsDiffer = (from, to) => {
  const fromCopy = { ...from };
  const toCopy = { ...to };
  delete fromCopy.color;
  delete toCopy.color;

  return (
    JSON.stringify(fromCopy) === JSON.stringify(toCopy) &&
    from.color !== to.color
  );
};

// Helper function to interpolate between backgrounds
const interpolateBackgrounds = (from, to, progress) => {
  const result = { ...to };

  // Interpolate color if both have colors
  if (from.color && to.color) {
    const fromColor = resolveCSSColor(from.color);
    const toColor = resolveCSSColor(to.color);

    if (fromColor && toColor) {
      const [rFrom, gFrom, bFrom, aFrom] = fromColor;
      const [rTo, gTo, bTo, aTo] = toColor;

      const r = Math.round(rFrom + (rTo - rFrom) * progress);
      const g = Math.round(gFrom + (gTo - gFrom) * progress);
      const b = Math.round(bFrom + (bTo - bFrom) * progress);
      const a = aFrom + (aTo - aFrom) * progress;

      result.color = stringifyCSSColor([r, g, b, a]);
    }
  }

  // TODO: Add gradient interpolation for matching gradient types

  return result;
};

// Helper functions for gradient detection
const isGradient = (value) => {
  return (
    typeof value === "string" &&
    (value.includes("linear-gradient") ||
      value.includes("radial-gradient") ||
      value.includes("conic-gradient"))
  );
};

const getGradientType = (gradientString) => {
  if (gradientString.includes("linear-gradient")) return "linear";
  if (gradientString.includes("radial-gradient")) return "radial";
  if (gradientString.includes("conic-gradient")) return "conic";
  return "unknown";
};

// Helper functions for getting natural values
export const getOpacityWithoutTransition = (element) =>
  getOpacity(element, transitionStyleController);
export const getTranslateXWithoutTransition = (element) =>
  getTranslateX(element, transitionStyleController);
export const getWidthWithoutTransition = (element) =>
  getWidth(element, transitionStyleController);
export const getHeightWithoutTransition = (element) =>
  getHeight(element, transitionStyleController);
