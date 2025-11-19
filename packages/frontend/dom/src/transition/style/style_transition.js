import { areSameRGBA } from "../../style/parsing/css_color.js";
import {
  parseStyle,
  stringifyStyle,
} from "../../style/parsing/style_parsing.js";
import {
  createStyleController,
  getBackground,
  getBackgroundColor,
  getBorderRadius,
  getHeight,
  getOpacity,
  getTranslateX,
  getWidth,
} from "../../style/style_controller.js";
import {
  combineTwoLifecycle,
  createTimelineTransition,
} from "../transition_playback.js";
import { getBackgroundColorAndImageInterpolation } from "./background_color_and_image_interpolation.js";
import { getBorderColorAndWidthInterpolation } from "./border_color_and_width_interpolation.js";
import {
  interpolateRGBA,
  prepareRGBATransitionPair,
} from "./color_interpolation.js";
import { createObjectInterpolation } from "./object_interpolation.js";

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

export const createBorderRadiusTransition = (element, to, options = {}) => {
  return createCSSPropertyTransition({
    ...options,
    constructor: createBorderRadiusTransition,
    element,
    styleProperty: "borderRadius",
    getFrom: () => {
      const computedStyle = getComputedStyle(element);
      return computedStyle.borderRadius;
    },
    to,
  });
};
export const createBorderTransition = (element, to, options = {}) => {
  const fromBorder = options.from || getBorder(element);
  const toBorder = parseStyle(to, "border", element);
  let borderInterpolation;
  interpolation: {
    // Handle simple cases where no transition is possible
    if (!fromBorder && !toBorder) {
      borderInterpolation = toBorder;
      break interpolation;
    }
    const colorAndWidthInterpolation = getBorderColorAndWidthInterpolation(
      fromBorder,
      toBorder,
    );
    borderInterpolation = colorAndWidthInterpolation;
  }

  const interpolateBorder = createObjectInterpolation(
    borderInterpolation,
    fromBorder,
    toBorder,
  );
  if (!interpolateBorder) {
    return createNoopCSSPropertyTransition({
      element,
      ...options,
    });
  }
  return createCSSPropertyTransition({
    constructor: createBackgroundTransition,
    element,
    styleProperty: "border",
    from: 0,
    to: 1,
    getFrom: () => 0,
    getValue: (transition) => {
      const borderInterpolated = interpolateBorder(transition);
      return stringifyStyle(borderInterpolated, "border");
    },
    ...options,
  });
};

export const createBackgroundTransition = (element, to, options = {}) => {
  const fromBackground = options.from || getBackground(element);
  const toBackground = parseStyle(to, "background", element);
  let backgrounInterpolation;
  interpolation: {
    // Handle simple cases where no transition is possible
    if (!fromBackground && !toBackground) {
      backgrounInterpolation = toBackground;
      break interpolation;
    }
    if (
      typeof fromBackground !== "object" ||
      typeof toBackground !== "object" ||
      Array.isArray(fromBackground) ||
      Array.isArray(toBackground)
    ) {
      backgrounInterpolation = toBackground;
      break interpolation;
    }
    const colorAndImageInterpolation = getBackgroundColorAndImageInterpolation(
      fromBackground,
      toBackground,
    );
    backgrounInterpolation = colorAndImageInterpolation;
  }

  const interpolateBackground = createObjectInterpolation(
    backgrounInterpolation,
    fromBackground,
    toBackground,
  );
  if (!interpolateBackground) {
    return createNoopCSSPropertyTransition({
      element,
      ...options,
    });
  }
  if (interpolateBackground === toBackground) {
    const toStyleCss = stringifyStyle(to, "background");
    console.warn(
      `Unsupported background transition between "${stringifyStyle(fromBackground, "background")}" and "${toStyleCss}"`,
    );
    return createInstantCSSPropertyTransition({
      element,
      value: toStyleCss,
      ...options,
    });
  }
  return createCSSPropertyTransition({
    constructor: createBackgroundTransition,
    element,
    styleProperty: "background",
    from: 0,
    to: 1,
    getFrom: () => 0,
    getValue: (transition) => {
      const backgroundInterpolated = interpolateBackground(transition);
      return stringifyStyle(backgroundInterpolated, "background");
    },
    ...options,
  });
};
export const createBackgroundColorTransition = (element, to, options = {}) => {
  const fromBackgroundColor = options.from || getBackgroundColor(element);
  const toBackgroundColor = parseStyle(to, "backgroundColor", element);
  const rgbaPair = prepareRGBATransitionPair(
    fromBackgroundColor,
    toBackgroundColor,
    element,
  );
  if (!rgbaPair) {
    return createNoopCSSPropertyTransition({ element, ...options });
  }
  const [fromRgba, toRgba] = rgbaPair;
  if (areSameRGBA(fromRgba, toRgba)) {
    return createNoopCSSPropertyTransition({ element, ...options });
  }
  return createCSSPropertyTransition({
    ...options,
    constructor: createBackgroundColorTransition,
    element,
    styleProperty: "backgroundColor",
    getFrom: () => 0,
    from: 0,
    to: 1,
    getValue: (transition) => {
      const rgbaInterpolated = interpolateRGBA(transition, fromRgba, toRgba);
      const backgroundColorInterpolated = stringifyStyle(
        rgbaInterpolated,
        "backgroundColor",
      );
      return backgroundColorInterpolated;
    },
  });
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
export const getBorderRadiusWithoutTransition = (element) =>
  getBorderRadius(element, transitionStyleController);
