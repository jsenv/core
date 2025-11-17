import { areSameRGBA, updateRGBA } from "../style/parsing/css_color.js";
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

// Helper function to prepare color transition pairs, handling edge cases
const prepareColorTransitionPair = (fromColor, toColor) => {
  const fromUnset = !fromColor;
  const toUnset = !toColor;

  // Both unset - no transition needed
  if (fromUnset && toUnset) {
    return null;
  }
  // Handle unset cases by using transparent versions
  if (fromUnset) {
    const toFullyTransparent = updateRGBA(toColor, { a: 0 });
    return [toFullyTransparent, toColor];
  }
  if (toUnset) {
    const fromFullyTransparent = updateRGBA(fromColor, { a: 0 });
    return [fromColor, fromFullyTransparent];
  }
  // Handle fully transparent cases
  const fromFullyTransparent = fromColor[3] === 0;
  const toFullyTransparent = toColor[3] === 0;
  if (fromFullyTransparent && toFullyTransparent) {
    return [fromColor, toColor];
  }
  if (fromFullyTransparent) {
    const toFullTransparent = updateRGBA(toColor, { a: 0 });
    return [toFullTransparent, toColor];
  }
  if (toFullyTransparent) {
    const fromFullyTransparent = updateRGBA(fromColor, { a: 0 });
    return [fromColor, fromFullyTransparent];
  }
  return [fromColor, toColor];
};
const applyColorTransition = (rgbaPair, transition) => {
  const [fromColor, toColor] = rgbaPair;
  const [rFrom, gFrom, bFrom, aFrom] = fromColor;
  const [rTo, gTo, bTo, aTo] = toColor;

  const r = applyTransitionProgress(transition, rFrom, rTo);
  const g = applyTransitionProgress(transition, gFrom, gTo);
  const b = applyTransitionProgress(transition, bFrom, bTo);
  const a = applyTransitionProgress(transition, aFrom, aTo);
  return [r, g, b, a];
};

export const createBackgroundColorTransition = (element, to, options = {}) => {
  const fromBackgroundColor = options.from || getBackgroundColor(element);
  const toBackgroundColor = normalizeStyle(
    to,
    "backgroundColor",
    "js",
    element,
  );
  const rgbaPair = prepareColorTransitionPair(
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
      const rgbaWithTransition = applyColorTransition(rgbaPair, transition);
      const backgroundColorWithTransition = normalizeStyle(
        rgbaWithTransition,
        "backgroundColor",
        "css",
      );
      return backgroundColorWithTransition;
    },
  });
};
export const createBackgroundTransition = (element, to, options = {}) => {
  const fromBackground = options.from || getBackground(element);
  const toBackground = normalizeStyle(to, "background", "js", element);

  // Handle simple cases where no transition is possible
  if (!fromBackground && !toBackground) {
    return createNoopCSSPropertyTransition({
      element,
      ...options,
    });
  }
  // If either is not an object (complex case), fall back to instant change
  if (
    typeof fromBackground !== "object" ||
    typeof toBackground !== "object" ||
    Array.isArray(fromBackground) ||
    Array.isArray(toBackground)
  ) {
    return createInstantCSSPropertyTransition({
      ...options,
      element,
      styleProperty: "background",
      value: normalizeStyle(toBackground, "background", "css"),
    });
  }
  debugger;
  const canTransition = canTransitionBackgrounds(fromBackground, toBackground);
  if (!canTransition) {
    return createInstantCSSPropertyTransition({
      ...options,
      element,
      styleProperty: "background",
      value: normalizeStyle(toBackground, "background", "css"),
    });
  }

  // Use unified transition logic for all compatible backgrounds
  const fromBackgroundColor = fromBackground.color;
  const toBackgroundColor = toBackground.color;
  const backgroundColorRgbaPair = prepareColorTransitionPair(
    fromBackgroundColor,
    toBackgroundColor,
  );
  return createCSSPropertyTransition({
    ...options,
    element,
    styleProperty: "background",
    getFrom: () => 0,
    from: 0,
    to: 1,
    getValue: (transition) => {
      const intermediateBackground = { ...toBackground };
      if (backgroundColorRgbaPair) {
        const rgbaWithTransition = applyColorTransition(
          backgroundColorRgbaPair,
          transition,
        );
        intermediateBackground.color = rgbaWithTransition;
      }
      return normalizeStyle(intermediateBackground, "background", "css");
    },
  });
};

// Helper function to check if backgrounds can be transitioned
const canTransitionBackgrounds = (from, to) => {
  // Handle transitions between different background types

  // Color transitions (including no color to color, color to no color)
  // No color is treated as transparent, so these are always compatible
  const fromHasImage = Boolean(from.image);
  const toHasImage = Boolean(to.image);

  // Color-only backgrounds (no images) can always transition
  if (!fromHasImage && !toHasImage) {
    return true;
  }

  // Image to image transitions (same structure)
  if (fromHasImage && toHasImage) {
    // Allow transition if images are identical objects
    if (areImageObjectsEqual(from.image, to.image)) {
      return true;
    }

    // Allow transition between gradients of the same type
    if (isGradientObject(from.image) && isGradientObject(to.image)) {
      return from.image.type === to.image.type;
    }
  }

  // Mixed transitions (gradient to color, color to gradient, etc.)
  // For now, these are not compatible for smooth transitions
  // TODO: Could implement smart transitions by extracting colors from gradients
  return false;
};

// Helper functions for image object detection
const isGradientObject = (imageObj) => {
  return (
    imageObj &&
    typeof imageObj === "object" &&
    imageObj.type &&
    imageObj.type.includes("gradient")
  );
};

const areImageObjectsEqual = (img1, img2) => {
  if (!img1 && !img2) return true;
  if (!img1 || !img2) return false;

  // For structured objects, compare type and key properties
  if (typeof img1 === "object" && typeof img2 === "object") {
    if (img1.type !== img2.type) return false;

    // For URLs, compare the actual URL value
    if (img1.type === "url") {
      return img1.value === img2.value;
    }

    // For gradients, we could do deeper comparison, but for now just compare type
    return img1.type === img2.type;
  }

  // Fallback to string comparison for non-objects
  return img1 === img2;
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
