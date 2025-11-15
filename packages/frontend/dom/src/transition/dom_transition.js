import {
  createStyleController,
  getHeight,
  getOpacity,
  getTranslateX,
  getWidth,
} from "../style/style_controller.js";
import {
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
 * @param {Function} config.getValue - Function to get current property value
 * @param {string|Object} config.styleProperty - CSS property name or style object path
 * @param {number} [config.minDiff] - Minimum difference threshold for the transition
 * @param {Object} [config.options={}] - Additional options
 * @param {string} [config.options.styleSynchronizer="js_animation"] - How to apply transition ("js_animation", "inline_style", or "--css-var-name")
 * @returns {Object} Timeline transition object
 */
const createCSSPropertyTransition = ({
  element,
  getValue,
  styleProperty,
  styleSynchronizer = "js_animation",
  lifecycle,
  ...options
}) => {
  if (typeof styleSynchronizer !== "string") {
    throw new Error("styleSynchronizer must be a string");
  }
  const setupSynchronizer = () => {
    if (styleSynchronizer === "inline_style") {
      return {
        update: ({ value }) => {
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
        update: ({ value }) => {
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
        update: ({ value }) => {
          element.setAttribute(attributeName, value);
        },
        restore: () => {
          element.removeAttribute(attributeName);
        },
      };
    }
    return {
      update: ({ value }) => {
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
          const from = getValue(element);
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

export const createHeightTransition = (element, to, options = {}) => {
  return createCSSPropertyTransition({
    ...options,
    constructor: createHeightTransition,
    element,
    getValue: getHeight,
    styleProperty: "height",
    to,
    minDiff: 10,
  });
};
export const createWidthTransition = (element, to, options = {}) => {
  return createCSSPropertyTransition({
    ...options,
    constructor: createWidthTransition,
    element,
    getValue: getWidth,
    styleProperty: "width",
    to,
    minDiff: 10,
  });
};
export const createOpacityTransition = (element, to, options = {}) => {
  return createCSSPropertyTransition({
    ...options,
    constructor: createOpacityTransition,
    element,
    getValue: getOpacity,
    styleProperty: "opacity",
    to,
    minDiff: 0.1,
  });
};
export const createTranslateXTransition = (element, to, options = {}) => {
  return createCSSPropertyTransition({
    ...options,
    constructor: createTranslateXTransition,
    element,
    getValue: getTranslateX,
    styleProperty: "transform.translateX",
    to,
    minDiff: 10,
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
