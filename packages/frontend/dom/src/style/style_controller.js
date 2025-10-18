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
 *
 * ## Solution:
 * Controller pattern + Web Animations API to preserve inline styles. Code that sets
 * inline styles expects to find them unchanged - we use animations for clean override:
 *
 * ```js
 * const controller = createStyleController("myFeature");
 * controller.set(element, { transform: "translateX(10px)", opacity: 0.5 });
 * controller.delete(element, "opacity"); // Only removes opacity, keeps transform
 * controller.clear(element); // Removes all styles from this controller only
 * controller.destroy(); // Cleanup when done
 * ```
 *
 * Multiple controllers can safely manage the same element without conflicts.
 */

import { mergeOneStyle, mergeStyles } from "./style_composition.js";
import { normalizeStyle, normalizeStyles } from "./style_parsing.js";

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

    // Update styles for this controller using mergeStyles
    const mergedStyles = mergeStyles(controllerStyles, styles);
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

  const getUnderlyingStyle = (element, propertyName) => {
    const elementControllers = elementStyleRegistry.get(element);

    if (!elementControllers || !elementControllers.has(controller)) {
      // This controller is not applied, just read current computed style
      return getComputedStyle(element)[propertyName];
    }

    // Check if other controllers would provide this style
    let styleFromOtherControllers = {};
    if (elementControllers.size > 1) {
      for (const otherController of elementControllers) {
        if (otherController === controller) continue;
        const otherStyles = otherController.get(element);
        styleFromOtherControllers = mergeStyles(
          styleFromOtherControllers,
          otherStyles,
        );
      }

      if (propertyName in styleFromOtherControllers) {
        return normalizeStyle(
          styleFromOtherControllers[propertyName],
          propertyName,
          "css",
        );
      }
    }

    // No other controllers provide this style, need to temporarily disable our animation
    const currentAnimation = animationRegistry.get(element);
    if (!currentAnimation) {
      return getComputedStyle(element)[propertyName];
    }

    // Temporarily cancel our animation to read underlying value
    currentAnimation.cancel();
    const underlyingValue = getComputedStyle(element)[propertyName];

    // Restore our animation
    const finalStyles = computeFinalStyles(element);
    const cssStyles = normalizeStyles(finalStyles, "css");
    const newAnimation = element.animate([cssStyles], {
      duration: 0,
      fill: "forwards",
    });
    animationRegistry.set(element, newAnimation);
    newAnimation.play();
    newAnimation.pause();

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
    getUnderlyingStyle,
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
