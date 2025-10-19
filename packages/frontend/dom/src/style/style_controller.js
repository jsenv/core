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
 * const actualWidth = controller.getUnderlyingValue(element, "rect.width"); // Layout measurements
 *
 * controller.delete(element, "opacity"); // Only removes opacity, keeps transform
 * controller.clear(element); // Removes all styles from this controller only
 * controller.destroy(); // Cleanup when done
 * ```
 *
 * **Key features:**
 * - **Transform composition**: Intelligently merges transform components instead of overwriting
 * - **Magic properties**: Access transform components with dot notation (e.g., "transform.translateX")
 * - **Layout measurements**: Access actual rendered dimensions with rect.* (e.g., "rect.width")
 * - **getUnderlyingValue()**: Read the "natural" value without this controller's influence
 * - **Smart units**: Numeric values get appropriate units automatically (px, deg, unitless)
 *
 * Multiple controllers can safely manage the same element without conflicts.
 */

import { mergeOneStyle, mergeStyles } from "./style_composition.js";
import { normalizeStyle, normalizeStyles } from "./style_parsing.js";

// Global registry to track all style controllers and their managed elements
const elementControllerSetRegistry = new WeakMap(); // element -> Set<controller>
const activeControllers = new Set(); // Set of all active controllers

export const createStyleController = (name = "anonymous") => {
  // Store styles for this specific controller
  const controllerStylesRegistry = new WeakMap(); // element -> styles
  // Store animations for this specific controller
  const controllerAnimationRegistry = new WeakMap(); // element -> animation

  // Apply styles for this controller only
  const applyStyles = (element) => {
    const controllerStyles = controllerStylesRegistry.get(element);

    if (!controllerStyles || Object.keys(controllerStyles).length === 0) {
      // No styles, clean up animation
      const animation = controllerAnimationRegistry.get(element);
      if (animation) {
        animation.cancel();
        controllerAnimationRegistry.delete(element);
      }
      return;
    }

    const cssStyles = normalizeStyles(controllerStyles, "css");
    const existingAnimation = controllerAnimationRegistry.get(element);
    const keyframes = [cssStyles];

    if (!existingAnimation) {
      const animation = element.animate(keyframes, {
        duration: 0,
        fill: "forwards",
      });
      // Set a debug name for this animation
      animation.id = name;
      controllerAnimationRegistry.set(element, animation);
      animation.play();
      animation.pause();
      return;
    }

    existingAnimation.effect.setKeyframes(keyframes);
    existingAnimation.play();
    existingAnimation.pause();
  };

  const set = (element, styles) => {
    if (!element || typeof element !== "object") {
      throw new Error("Element must be a valid DOM element");
    }
    if (!styles || typeof styles !== "object") {
      throw new Error("Styles must be an object");
    }

    if (!elementControllerSetRegistry.has(element)) {
      elementControllerSetRegistry.set(element, new Set());
    }
    const elementControllerSet = elementControllerSetRegistry.get(element);
    elementControllerSet.add(controller);
    if (!controllerStylesRegistry.has(element)) {
      controllerStylesRegistry.set(element, {});
    }
    const controllerStyles = controllerStylesRegistry.get(element);
    const normalizedStyles = normalizeStyles(styles, "js");
    const mergedStyles = mergeStyles(controllerStyles, normalizedStyles);
    controllerStylesRegistry.set(element, mergedStyles);
    applyStyles(element);
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
        const elementControllerSet = elementControllerSetRegistry.get(element);
        if (elementControllerSet) {
          elementControllerSet.delete(controller);
          // Clean up empty element registry
          if (elementControllerSet.size === 0) {
            elementControllerSetRegistry.delete(element);
          }
        }
      }

      // Recompute and apply final styles (or clean up animation if no styles left)
      applyStyles(element);
    }
  };

  const commit = (element) => {
    const controllerStyles = controllerStylesRegistry.get(element);
    if (!controllerStyles) {
      return; // No styles to commit from this controller
    }

    // Cancel our animation permanently since we're committing styles to inline
    const animation = controllerAnimationRegistry.get(element);
    if (animation) {
      animation.cancel();
      controllerAnimationRegistry.delete(element);
    }

    // Now read the true underlying styles (without our animation influence)
    const computedStyles = getComputedStyle(element);

    // Convert controller styles to CSS and commit to inline styles
    const cssStyles = normalizeStyles(controllerStyles, "css");

    for (const [key, value] of Object.entries(cssStyles)) {
      // Merge with existing computed styles for all properties
      const existingValue = computedStyles[key];
      element.style[key] = mergeOneStyle(existingValue, value, key, "css");
    }

    // Clear this controller's styles since they're now inline
    controllerStylesRegistry.delete(element);

    // Clean up controller from element registry
    const elementControllerSet = elementControllerSetRegistry.get(element);
    if (elementControllerSet) {
      elementControllerSet.delete(controller);
      if (elementControllerSet.size === 0) {
        elementControllerSetRegistry.delete(element);
      }
    }
  };

  const clear = (element) => {
    controllerStylesRegistry.delete(element);
    const elementControllerSet = elementControllerSetRegistry.get(element);
    if (elementControllerSet) {
      elementControllerSet.delete(controller);

      // Clean up empty element registry
      if (elementControllerSet.size === 0) {
        elementControllerSetRegistry.delete(element);
      }
    }
    // Recompute and apply final styles
    applyStyles(element);
  };

  const getUnderlyingValue = (element, propertyName) => {
    const elementControllerSet = elementControllerSetRegistry.get(element);

    const normalizeValueForJs = (value) => {
      // Use normalizeStyle to handle all property types including transform dot notation
      return normalizeStyle(value, propertyName, "js");
    };

    const getFromOtherControllers = () => {
      if (!elementControllerSet || elementControllerSet.size <= 1) {
        return undefined;
      }

      let resultValue;
      for (const otherController of elementControllerSet) {
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

      // Note: For CSS width/height properties, we can trust the values from other controllers
      // because we assume box-sizing: border-box. If the element used content-box,
      // the CSS width/height would differ from getBoundingClientRect() due to padding/borders,
      // but since controllers set the final rendered size, the CSS value is what matters.
      // For actual layout measurements, use rect.* properties instead.
      return normalizeValueForJs(resultValue);
    };

    const getFromDOM = () => {
      // Handle transform dot notation
      if (propertyName.startsWith("transform.")) {
        const transformValue = getComputedStyle(element).transform;
        return normalizeValueForJs(transformValue);
      }
      // For all other CSS properties, use computed styles
      const computedValue = getComputedStyle(element)[propertyName];
      return normalizeValueForJs(computedValue);
    };

    const getFromDOMLayout = () => {
      // For rect.* properties that reflect actual layout, always read from DOM
      // These represent the actual rendered dimensions, bypassing any controller influence
      if (propertyName === "rect.width") {
        return element.getBoundingClientRect().width;
      }
      if (propertyName === "rect.height") {
        return element.getBoundingClientRect().height;
      }
      if (propertyName === "rect.left") {
        return element.getBoundingClientRect().left;
      }
      if (propertyName === "rect.top") {
        return element.getBoundingClientRect().top;
      }
      if (propertyName === "rect.right") {
        return element.getBoundingClientRect().right;
      }
      if (propertyName === "rect.bottom") {
        return element.getBoundingClientRect().bottom;
      }
      return undefined;
    };

    const getWhileDisablingThisController = (fn) => {
      const currentAnimation = controllerAnimationRegistry.get(element);
      if (!currentAnimation) {
        return fn();
      }

      // Temporarily cancel our animation to read underlying value
      currentAnimation.cancel();
      controllerAnimationRegistry.delete(element); // Remove cancelled animation from registry
      const underlyingValue = fn();
      // Restore our animation
      applyStyles(element);
      return underlyingValue;
    };

    if (typeof propertyName === "function") {
      return getWhileDisablingThisController(propertyName);
    }

    // Handle computed layout properties (rect.*) - always read from DOM, bypass controllers
    if (propertyName.startsWith("rect.")) {
      return getWhileDisablingThisController(getFromDOMLayout);
    }
    if (!elementControllerSet || !elementControllerSet.has(controller)) {
      // This controller is not applied, just read current value
      return getFromDOM();
    }
    // Check if other controllers would provide this style
    const valueFromOtherControllers = getFromOtherControllers();
    if (valueFromOtherControllers !== undefined) {
      return valueFromOtherControllers;
    }
    return getWhileDisablingThisController(getFromDOM);
  };

  const destroy = () => {
    // Remove this controller from all elements and clean up animations
    for (const [
      element,
      elementControllerSet,
    ] of elementControllerSetRegistry) {
      if (!elementControllerSet.has(controller)) {
        continue;
      }
      elementControllerSet.delete(controller);
      controllerStylesRegistry.delete(element);

      // Clean up this controller's animation
      const animation = controllerAnimationRegistry.get(element);
      if (animation) {
        animation.cancel();
        controllerAnimationRegistry.delete(element);
      }

      // Clean up empty element registry
      if (elementControllerSet.size === 0) {
        elementControllerSetRegistry.delete(element);
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
