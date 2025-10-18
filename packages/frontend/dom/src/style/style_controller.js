/**
 * Creates a style controller for managing CSS styles with animation support.
 *
 * Features:
 * - Multiple controllers can manage styles on the same element
 * - Automatic garbage collection via WeakMap when elements are garbage collected
 * - Web Animations API integration for smooth transitions
 * - Conflict resolution between controllers
 */

import { mergeOneStyle, mergeStyles } from "./style_composition.js";
import { normalizeStyles } from "./style_parsing.js";

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

  const remove = (element, propertyName) => {
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

    for (const key of finalStyles) {
      const value = finalStyles[key];
      const existingValue = computedStyles[key];
      element.style[key] = mergeOneStyle(existingValue, value, key);
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
    remove,
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
  const normalizedStyles = normalizeStyles(finalStyles);
  const exisitingAnimation = animationRegistry.get(element);
  const keyframes = [normalizedStyles];
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
