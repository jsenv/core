import {
  createStyleController,
  getHeight,
  getOpacity,
  getTranslateX,
  getWidth,
} from "../style/style_controller.js";
import { createTimelineTransition } from "./transition_playback.js";

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
  constructor,
  element,
  to,
  getValue,
  styleProperty,
  minDiff,
  options = {},
}) => {
  const {
    setup,
    finish,
    styleSynchronizer = "js_animation",
    ...rest
  } = options;

  const lifecycle = {
    setup: () => {
      const teardown = setup?.();
      const from = getValue(element);

      if (styleSynchronizer === "inline_style") {
        // Apply transition directly to element.style
        return {
          from,
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
          teardown: () => {
            teardown?.();
          },
        };
      }

      // Check if it's a CSS variable (starts with --)
      if (
        typeof styleSynchronizer === "string" &&
        styleSynchronizer.startsWith("--")
      ) {
        // Apply transition via CSS custom property
        return {
          from,
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
          teardown: () => {
            teardown?.();
          },
        };
      }

      // Default: use style controller (js_animation)
      return {
        from,
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
        teardown: () => {
          teardown?.();
        },
      };
    },
    finish,
  };

  return createTimelineTransition({
    ...rest,
    constructor,
    key: element,
    to,
    minDiff,
    isVisual: true,
    lifecycle,
  });
};

export const createHeightTransition = (element, to, options = {}) => {
  return createCSSPropertyTransition({
    constructor: createHeightTransition,
    element,
    to,
    getValue: getHeight,
    styleProperty: "height",
    minDiff: 10,
    options,
  });
};
export const createWidthTransition = (element, to, options = {}) => {
  return createCSSPropertyTransition({
    constructor: createWidthTransition,
    element,
    to,
    getValue: getWidth,
    styleProperty: "width",
    minDiff: 10,
    options,
  });
};
export const createOpacityTransition = (element, to, options = {}) => {
  return createCSSPropertyTransition({
    constructor: createOpacityTransition,
    element,
    to,
    getValue: getOpacity,
    styleProperty: "opacity",
    minDiff: 0.1,
    options,
  });
};
export const createTranslateXTransition = (element, to, options = {}) => {
  return createCSSPropertyTransition({
    constructor: createTranslateXTransition,
    element,
    to,
    getValue: getTranslateX,
    styleProperty: "transform.translateX",
    minDiff: 10,
    options,
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
