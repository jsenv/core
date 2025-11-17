import { areSameRGBA, parseCSSColor } from "../../style/parsing/css_color.js";
import { normalizeStyle } from "../../style/parsing/style_parsing.js";
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
  applyColorTransition,
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

// Helper to interpolate gradient color stops toward a target color
const interpolateGradientToColor = (
  gradientImage,
  targetColor,
  progress,
  element,
) => {
  const resolvedTargetColor = parseCSSColor(targetColor, element);
  if (!resolvedTargetColor) return gradientImage;

  // Clone the gradient image object
  const interpolatedGradient = { ...gradientImage };

  // Interpolate color stops if they exist
  if (gradientImage.stops && Array.isArray(gradientImage.stops)) {
    interpolatedGradient.stops = gradientImage.stops.map((stop) => {
      if (stop.color) {
        const stopColor = parseCSSColor(stop.color, element);
        if (stopColor) {
          // Interpolate each channel toward the target color
          const [rFrom, gFrom, bFrom, aFrom] = stopColor;
          const [rTo, gTo, bTo, aTo] = resolvedTargetColor;
          const r = Math.round(rFrom + (rTo - rFrom) * progress);
          const g = Math.round(gFrom + (gTo - gFrom) * progress);
          const b = Math.round(bFrom + (bTo - bFrom) * progress);
          const a = aFrom + (aTo - aFrom) * progress;
          return { ...stop, color: [r, g, b, a] };
        }
      }
      return stop;
    });
  }

  return interpolatedGradient;
};

// Helper to interpolate between two gradients of the same type
const interpolateGradientToGradient = (
  fromGradient,
  toGradient,
  progress,
  element,
) => {
  if (fromGradient.type !== toGradient.type) {
    return toGradient; // Different types, return target
  }

  // Clone the target gradient as base
  const interpolatedGradient = { ...toGradient };

  // Interpolate color stops if both have them
  if (
    fromGradient.stops &&
    toGradient.stops &&
    Array.isArray(fromGradient.stops) &&
    Array.isArray(toGradient.stops)
  ) {
    // Use the longer stops array as base, interpolate corresponding stops
    const maxStops = Math.max(
      fromGradient.stops.length,
      toGradient.stops.length,
    );
    interpolatedGradient.stops = [];

    for (let i = 0; i < maxStops; i++) {
      const fromStop = fromGradient.stops[i];
      const toStop = toGradient.stops[i];

      if (fromStop && toStop) {
        // Both stops exist - interpolate them
        const interpolatedStop = { ...toStop };

        if (fromStop.color && toStop.color) {
          const fromColor = parseCSSColor(fromStop.color, element);
          const toColor = parseCSSColor(toStop.color, element);

          if (fromColor && toColor) {
            const [rFrom, gFrom, bFrom, aFrom] = fromColor;
            const [rTo, gTo, bTo, aTo] = toColor;
            const r = Math.round(rFrom + (rTo - rFrom) * progress);
            const g = Math.round(gFrom + (gTo - gFrom) * progress);
            const b = Math.round(bFrom + (bTo - bFrom) * progress);
            const a = aFrom + (aTo - aFrom) * progress;
            interpolatedStop.color = [r, g, b, a];
          }
        }

        // TODO: Could also interpolate position if both have positions
        interpolatedGradient.stops.push(interpolatedStop);
      } else if (toStop) {
        // Only target stop exists - use it as-is
        interpolatedGradient.stops.push({ ...toStop });
      } else if (fromStop) {
        // Only source stop exists - fade it toward transparent or skip
        // For now, skip it (it will disappear)
      }
    }
  }

  return interpolatedGradient;
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
          const rgbaWithTransition = applyColorTransition(
            backgroundColorRgbaPair,
            transition,
          );
          intermediateBackground.color = rgbaWithTransition;
        }
        return normalizeStyle(intermediateBackground, "background", "css");
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
        const progress = transition.value;
        const intermediateBackground = { ...fromBackground };
        intermediateBackground.image = interpolateGradientToColor(
          fromBackground.image,
          toBackground.color,
          progress,
          element,
        );
        // Remove any background color to let the gradient be the only background
        delete intermediateBackground.color;
        return normalizeStyle(intermediateBackground, "background", "css");
      },
    });
  }

  // Case 3: Color to Gradient transitions
  if (!fromHasImage && fromBackground.color && toHasGradient) {
    // For now, use instant change - could implement reverse interpolation later
    return createInstantCSSPropertyTransition({
      ...options,
      element,
      styleProperty: "background",
      value: normalizeStyle(toBackground, "background", "css"),
    });
  }

  // Same gradient type transitions
  if (
    fromHasGradient &&
    toHasGradient &&
    fromBackground.image.type === toBackground.image.type
  ) {
    return createCSSPropertyTransition({
      ...options,
      element,
      styleProperty: "background",
      getFrom: () => 0,
      from: 0,
      to: 1,
      getValue: (transition) => {
        const progress = transition.value;
        const intermediateBackground = { ...toBackground };
        intermediateBackground.image = interpolateGradientToGradient(
          fromBackground.image,
          toBackground.image,
          progress,
          element,
        );

        // Also interpolate background color if both have it
        const fromBackgroundColor = fromBackground.color;
        const toBackgroundColor = toBackground.color;
        if (fromBackgroundColor || toBackgroundColor) {
          const backgroundColorRgbaPair = prepareColorTransitionPair(
            fromBackgroundColor,
            toBackgroundColor,
          );
          if (backgroundColorRgbaPair) {
            const rgbaWithTransition = applyColorTransition(
              backgroundColorRgbaPair,
              transition,
            );
            intermediateBackground.color = rgbaWithTransition;
          }
        }

        return normalizeStyle(intermediateBackground, "background", "css");
      },
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
          const rgbaWithTransition = applyColorTransition(
            backgroundColorRgbaPair,
            transition,
          );
          intermediateBackground.color = rgbaWithTransition;
        }
        return normalizeStyle(intermediateBackground, "background", "css");
      },
    });
  }

  // All other cases: instant change
  return createInstantCSSPropertyTransition({
    ...options,
    element,
    styleProperty: "background",
    value: normalizeStyle(toBackground, "background", "css"),
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
