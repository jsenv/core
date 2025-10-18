/**
 * Style Controller System
 *
 * Solves CSS style manipulation problems in JavaScript:
 *
 * ## Main problems:
 * 1. **Temporary style override**: Code wants to read current style, force another style,
 *    then restore original. With inline styles this is ugly and loses original info.
 * 2. **Multiple code parts**: When different parts of code want to touch styles simultaneously,
 *    they step on each other (rare but happens).
 * 3. **Transform composition**: CSS transforms are especially painful - you want to keep
 *    existing transforms but force specific parts (e.g., keep `rotate(45deg)` but override
 *    `translateX`). Native CSS overwrites the entire transform property.
 *
 * ## Solution:
 * Controller pattern + Web Animations API to preserve inline styles. Code that sets
 * inline styles expects to find them unchanged - we use animations for clean override:
 *
 * ```js
 * const controller = createStyleController("myFeature");
 *
 * // Smart value conversion (100 → "100px", 45 → "45deg")
 * controller.set(element, {
 *   transform: { translateX: 100, rotate: 45 }, // Individual transform properties
 *   opacity: 0.5
 * });
 *
 * // Transform objects merged intelligently
 * controller.set(element, {
 *   transform: { translateX: 50 } // Merges with existing transforms
 * });
 *
 * // Get underlying value without this controller's influence
 * const originalOpacity = controller.getUnderlyingValue(element, "opacity");
 * const originalTranslateX = controller.getUnderlyingValue(element, "transform.translateX"); // Magic dot notation!
 *
 * controller.delete(element, "opacity"); // Only removes opacity, keeps transform
 * controller.clear(element); // Removes all styles from this controller only
 * controller.destroy(); // Cleanup when done
 * ```
 *
 * **Key features:**
 * - **Transform composition**: Intelligently merges transform components instead of overwriting
 * - **Magic properties**: Access transform components with dot notation (e.g., "transform.translateX")
 * - **getUnderlyingValue()**: Read the "natural" value without this controller's influence
 * - **Smart units**: Numeric values get appropriate units automatically (px, deg, unitless)
 *
 * Multiple controllers can safely manage the same element without conflicts.
 */

import { mergeOneStyle, mergeStyles } from "./style_composition.js";
import {
  normalizeStyle,
  normalizeStyles,
  parseCSSTransform,
} from "./style_parsing.js";

// Global registry to track all style controllers and their managed elements
const elementStyleRegistry = new WeakMap(); // element -> Set<controller>
const activeControllers = new Set(); // Set of all active controllers
const animationRegistry = new WeakMap(); // element -> active animations

export const createStyleController = (name = "anonymous") => {
  // Store styles for this specific controller
  const controllerStylesRegistry = new WeakMap(); // element -> styles

  const set = (element, styles) => {
    if (!element || typeof element !== "object") {
      throw new Error("Element must be a valid DOM element");
    }
    if (!styles || typeof styles !== "object") {
      throw new Error("Styles must be an object");
    }

    // Initialize element registry if needed
    if (!elementStyleRegistry.has(element)) {
      elementStyleRegistry.set(element, new Set());
    }

    const elementControllers = elementStyleRegistry.get(element);
    elementControllers.add(controller);

    // Initialize controller styles if needed
    if (!controllerStylesRegistry.has(element)) {
      controllerStylesRegistry.set(element, {});
    }

    const controllerStyles = controllerStylesRegistry.get(element);

    // Apply smart normalization to incoming styles using normalizeStyles
    const normalizedStyles = normalizeStyles(styles, "js");

    // Update styles for this controller using mergeStyles
    const mergedStyles = mergeStyles(controllerStyles, normalizedStyles);
    controllerStylesRegistry.set(element, mergedStyles);

    // Recompute and apply final styles
    applyFinalStyles(element);
  };

  const get = (element) => {
    const controllerStyles = controllerStylesRegistry.get(element);
    return controllerStyles ? { ...controllerStyles } : {};
  };

  const deleteMethod = (element, propertyName) => {
    const controllerStyles = controllerStylesRegistry.get(element);

    if (controllerStyles && propertyName in controllerStyles) {
      delete controllerStyles[propertyName];
      const isEmpty = Object.keys(controllerStyles).length === 0;
      // Clean up empty controller
      if (isEmpty) {
        controllerStylesRegistry.delete(element);
        const elementControllers = elementStyleRegistry.get(element);
        if (elementControllers) {
          elementControllers.delete(controller);

          // Clean up empty element registry
          if (elementControllers.size === 0) {
            elementStyleRegistry.delete(element);
          }
        }
      }

      // Recompute and apply final styles
      applyFinalStyles(element);
    }
  };

  const commit = (element) => {
    const finalStyles = computeFinalStyles(element);

    // Read existing styles to compose with them
    const computedStyles = getComputedStyle(element);

    for (const [key, value] of Object.entries(finalStyles)) {
      const existingValue = computedStyles[key];
      element.style[key] = mergeOneStyle(existingValue, value, key, "css");
    }
  };

  const clear = (element) => {
    controllerStylesRegistry.delete(element);
    const elementControllers = elementStyleRegistry.get(element);
    if (elementControllers) {
      elementControllers.delete(controller);

      // Clean up empty element registry
      if (elementControllers.size === 0) {
        elementStyleRegistry.delete(element);
      }
    }
    // Recompute and apply final styles
    applyFinalStyles(element);
  };

  const getUnderlyingValue = (element, propertyName) => {
    const elementControllers = elementStyleRegistry.get(element);

    const getFromOtherController = (resultValue) => {
      return getIt(resultValue, "js");
    };
    const getFromDOM = () => {
      return getIt(getComputedStyle(element)[propertyName], "css");
    };

    const getIt = () => {
      // Handle dot notation for transform properties (e.g., "transform.translateX")
      if (propertyName.startsWith("transform.")) {
        const transformProperty = propertyName.slice(10); // Remove "transform." prefix
        const transformValue = getComputedStyle(element).transform;
        if (!transformValue || transformValue === "none") {
          // Return default values and let normalizeStyle handle js context conversion
          const defaultValue = transformProperty.includes("scale") ? "1" : "0";
          return normalizeStyle(defaultValue, propertyName, "js");
        }
        // Parse transform and extract the specific property
        const transformObj = parseCSSTransform(transformValue);
        const value = transformObj[transformProperty];
        if (value) {
          return normalizeStyle(value, propertyName, "js");
        }
        // Return defaults
        const defaultValue = transformProperty.includes("scale") ? "1" : "0";
        return normalizeStyle(defaultValue, propertyName, "js");
      }

      // Handle dimensional properties - return numbers without units
      if (propertyName === "width") {
        return element.getBoundingClientRect().width;
      }
      if (propertyName === "height") {
        return element.getBoundingClientRect().height;
      }
      if (propertyName === "left") {
        return element.getBoundingClientRect().left;
      }
      if (propertyName === "top") {
        return element.getBoundingClientRect().top;
      }
      if (propertyName === "right") {
        return element.getBoundingClientRect().right;
      }
      if (propertyName === "bottom") {
        return element.getBoundingClientRect().bottom;
      }

      // Handle special numeric properties
      if (propertyName === "opacity") {
        const value = getComputedStyle(element).opacity;
        return normalizeStyle(value, propertyName, "js");
      }
      if (propertyName === "zIndex") {
        const value = getComputedStyle(element).zIndex;
        return value === "auto"
          ? "auto"
          : normalizeStyle(value, propertyName, "js");
      }

      // Default: return computed style and normalize for js context
      const value = getComputedStyle(element)[propertyName];
      return normalizeStyle(value, propertyName, "js");
    };

    if (!elementControllers || !elementControllers.has(controller)) {
      // This controller is not applied, just read current computed style
      return getFromDOM();
    }

    // Check if other controllers would provide this style
    from_other_controller: {
      if (elementControllers.size <= 1) {
        break from_other_controller;
      }
      let resultValue;
      for (const otherController of elementControllers) {
        if (otherController === controller) continue;
        const otherStyles = otherController.get(element);
        if (propertyName in otherStyles) {
          resultValue = mergeOneStyle(
            resultValue,
            otherStyles[propertyName],
            propertyName,
          );
        }
      }
      if (resultValue !== undefined) {
        return getFromOtherController(resultValue);
      }
    }

    // No other controllers provide this style, need to temporarily disable our animation
    const currentAnimation = animationRegistry.get(element);
    if (!currentAnimation) {
      return getFromDOM();
    }

    // Temporarily cancel our animation to read underlying value
    currentAnimation.cancel();
    animationRegistry.delete(element); // Remove cancelled animation from registry
    const underlyingValue = getFromDOM();

    // Restore our animation
    applyFinalStyles(element);

    return underlyingValue;
  };

  const destroy = () => {
    // Remove this controller from all elements
    for (const [element, elementControllers] of elementStyleRegistry) {
      if (!elementControllers.has(controller)) {
        continue;
      }
      elementControllers.delete(controller);
      controllerStylesRegistry.delete(element);

      // Clean up empty element registry
      if (elementControllers.size === 0) {
        elementStyleRegistry.delete(element);
      } else {
        // Recompute styles for remaining controllers
        applyFinalStyles(element);
      }
    }

    activeControllers.delete(controller);
  };

  const controller = {
    name,
    set,
    get,
    delete: deleteMethod,
    getUnderlyingValue,
    commit,
    clear,
    destroy,
  };

  activeControllers.add(controller);
  return controller;
};

// Compute final styles by merging all controllers' styles for an element
const computeFinalStyles = (element) => {
  let finalStyles = {};
  const elementControllers = elementStyleRegistry.get(element);
  if (!elementControllers) {
    return finalStyles;
  }
  // Merge styles from all controllers
  for (const controller of elementControllers) {
    const controllerStyles = controller.get(element);
    finalStyles = mergeStyles(finalStyles, controllerStyles);
  }
  return finalStyles;
};

// Apply final computed styles with animation support
const applyFinalStyles = (element) => {
  const finalStyles = computeFinalStyles(element);
  const cssStyles = normalizeStyles(finalStyles, "css");

  const exisitingAnimation = animationRegistry.get(element);
  const keyframes = [cssStyles];
  if (!exisitingAnimation) {
    const animation = element.animate(keyframes, {
      duration: 0,
      fill: "forwards",
    });
    animationRegistry.set(element, animation);
    animation.play();
    animation.pause();
    return;
  }
  exisitingAnimation.effect.setKeyframes(keyframes);
  exisitingAnimation.play();
  exisitingAnimation.pause();
};
