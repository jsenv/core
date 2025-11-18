import { areSameRGBA } from "../../style/parsing/css_color.js";
import {
  parseStyle,
  stringifyStyle,
} from "../../style/parsing/style_parsing.js";
import {
  createStyleController,
  getBackground,
  getBackgroundColor,
  getHeight,
  getOpacity,
  getTranslateX,
  getWidth,
} from "../../style/style_controller.js";
import {
  combineTwoLifecycle,
  createTimelineTransition,
} from "../transition_playback.js";
import {
  applyColorToColor,
  applyColorToGradient,
  applyGradientToColor,
  applyGradientToGradient,
  prepareColorTransitionPair,
} from "./color_transition.js";

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
  const toBackgroundColor = parseStyle(to, "backgroundColor", element);
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
      const rgbaWithTransition = applyColorToColor(rgbaPair, transition);
      const backgroundColorWithTransition = stringifyStyle(
        rgbaWithTransition,
        "backgroundColor",
      );
      return backgroundColorWithTransition;
    },
  });
};

export const createBackgroundTransition = (element, to, options = {}) => {
  const fromBackground = options.from || getBackground(element);
  const toBackground = parseStyle(to, "background", element);

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
      value: stringifyStyle(toBackground, "background"),
    });
  }

  const fromHasImage = Boolean(fromBackground.image);
  const toHasImage = Boolean(toBackground.image);
  const fromHasGradient =
    fromHasImage && isGradientObject(fromBackground.image);
  const toHasGradient = toHasImage && isGradientObject(toBackground.image);

  // Case 1: Color to Color transitions (including no color to color)
  if (!fromHasImage && !toHasImage) {
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
          const rgbaWithTransition = applyColorToColor(
            backgroundColorRgbaPair,
            transition,
          );
          intermediateBackground.color = rgbaWithTransition;
        }
        return stringifyStyle(intermediateBackground, "background");
      },
    });
  }
  // Case 2: Gradient to Color transitions
  if (fromHasGradient && !toHasImage && toBackground.color) {
    return createCSSPropertyTransition({
      ...options,
      element,
      styleProperty: "background",
      getFrom: () => 0,
      from: 0,
      to: 1,
      getValue: (transition) => {
        const intermediateBackground = { ...fromBackground };
        intermediateBackground.image = applyGradientToColor(
          fromBackground.image,
          toBackground.color,
          transition,
        );
        // Remove the original gradient since we're transitioning to a solid color
        if (transition.value === 1) {
          delete intermediateBackground.image;
          intermediateBackground.color = toBackground.color;
        }
        return stringifyStyle(intermediateBackground, "background");
      },
    });
  }
  // Case 3: Color to Gradient transitions
  if (!fromHasImage && fromBackground.color && toHasGradient) {
    return createCSSPropertyTransition({
      ...options,
      element,
      styleProperty: "background",
      getFrom: () => 0,
      from: 0,
      to: 1,
      getValue: (transition) => {
        const intermediateBackground = { ...toBackground };
        intermediateBackground.image = applyColorToGradient(
          fromBackground.color,
          toBackground.image,
          transition,
        );
        return stringifyStyle(intermediateBackground, "background");
      },
    });
  }
  // Case 4: Gradient to Gradient transitions (same or different types)
  if (fromHasGradient && toHasGradient) {
    const fromGradientType = fromBackground.image.type;
    const toGradientType = toBackground.image.type;
    const isSameGradientType = fromGradientType === toGradientType;

    // Check if this is a supported cross-gradient transition
    const isSupportedCrossTransition =
      !isSameGradientType &&
      areGradientsCompatibleForTransition(
        fromBackground.image,
        toBackground.image,
      );

    if (isSameGradientType || isSupportedCrossTransition) {
      return createCSSPropertyTransition({
        ...options,
        element,
        styleProperty: "background",
        getFrom: () => 0,
        from: 0,
        to: 1,
        getValue: (transition) => {
          const intermediateBackground = { ...toBackground };

          if (isSameGradientType) {
            // Same type: use direct gradient interpolation
            intermediateBackground.image = applyGradientToGradient(
              fromBackground.image,
              toBackground.image,
              transition,
            );
          } else {
            // Different types: use cross-gradient interpolation
            intermediateBackground.image = applyCrossGradientTransition(
              fromBackground.image,
              toBackground.image,
              transition,
            );
          }

          // Also interpolate background color if both have it
          const fromBackgroundColor = fromBackground.color;
          const toBackgroundColor = toBackground.color;
          if (fromBackgroundColor || toBackgroundColor) {
            const backgroundColorRgbaPair = prepareColorTransitionPair(
              fromBackgroundColor,
              toBackgroundColor,
            );
            if (backgroundColorRgbaPair) {
              const rgbaWithTransition = applyColorToColor(
                backgroundColorRgbaPair,
                transition,
              );
              intermediateBackground.color = rgbaWithTransition;
            }
          }

          return stringifyStyle(intermediateBackground, "background");
        },
      });
    }

    // Unsupported cross-gradient transition - fall back to instant change
    console.warn(
      `Unsupported gradient transition from ${fromGradientType} to ${toGradientType}`,
    );
    return createInstantCSSPropertyTransition({
      ...options,
      element,
      styleProperty: "background",
      value: stringifyStyle(toBackground, "background"),
    });
  }
  // Identical image transitions
  if (
    fromHasImage &&
    toHasImage &&
    areImageObjectsEqual(fromBackground.image, toBackground.image)
  ) {
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
          const rgbaWithTransition = applyColorToColor(
            backgroundColorRgbaPair,
            transition,
          );
          intermediateBackground.color = rgbaWithTransition;
        }
        return stringifyStyle(intermediateBackground, "background");
      },
    });
  }

  const toBackgroundCss = stringifyStyle(toBackground, "background");
  console.warn(
    `Unsupported background transition between "${stringifyStyle(fromBackground, "background")}" and "${toBackgroundCss}"`,
  );
  // All other cases: instant change
  return createInstantCSSPropertyTransition({
    ...options,
    element,
    styleProperty: "background",
    value: toBackgroundCss,
  });
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

// Check if two gradients are compatible for cross-type transitions
const areGradientsCompatibleForTransition = (fromGradient, toGradient) => {
  // All gradient types can transition to each other as long as both have colors
  return (
    fromGradient.colors &&
    toGradient.colors &&
    Array.isArray(fromGradient.colors) &&
    Array.isArray(toGradient.colors) &&
    fromGradient.colors.length > 0 &&
    toGradient.colors.length > 0
  );
};

// Apply transition between different gradient types
const applyCrossGradientTransition = (fromGradient, toGradient, transition) => {
  // For cross-gradient transitions, we morph towards the target gradient
  // while interpolating the colors
  const interpolatedGradient = { ...toGradient };

  // Interpolate colors if both gradients have them
  if (
    fromGradient.colors &&
    toGradient.colors &&
    Array.isArray(fromGradient.colors) &&
    Array.isArray(toGradient.colors)
  ) {
    const maxStops = Math.max(
      fromGradient.colors.length,
      toGradient.colors.length,
    );
    interpolatedGradient.colors = [];

    for (let i = 0; i < maxStops; i++) {
      const fromStop = fromGradient.colors[i];
      const toStop = toGradient.colors[i];

      if (fromStop && toStop) {
        // Both stops exist - interpolate them
        const interpolatedStop = { ...toStop };

        if (fromStop.color && toStop.color) {
          const colorPair = [fromStop.color, toStop.color];
          interpolatedStop.color = applyColorToColor(colorPair, transition);
        }

        // For cross-gradient transitions, use target positions
        // (morphing shape/direction is more important than position interpolation)
        interpolatedGradient.colors.push(interpolatedStop);
      } else if (toStop) {
        // Only target stop exists - use it as-is
        interpolatedGradient.colors.push({ ...toStop });
      }
      // Skip fromStop-only cases in cross transitions
    }
  }

  return interpolatedGradient;
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
