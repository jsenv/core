/**
 * Creates a style controller for managing CSS styles with animation support.
 *
 * Features:
 * - Multiple controllers can manage styles on the same element
 * - Automatic garbage collection via WeakMap when elements are garbage collected
 * - Web Animations API integration for smooth transitions
 * - Conflict resolution between controllers
 */

import { mergeStyles } from "./style_composition.js";
import { normalizeStyles } from "./style_parsing.js";

// Global registry to track all style controllers and their managed elements
const elementStyleRegistry = new WeakMap(); // element -> Map<controllerName, styles>
const activeControllers = new Set(); // Set of all active controllers
const animationRegistry = new WeakMap(); // element -> active animations

export const createStyleController = (name = "anonymous") => {
  const set = (element, styles) => {
    if (!element || typeof element !== "object") {
      throw new Error("Element must be a valid DOM element");
    }
    if (!styles || typeof styles !== "object") {
      throw new Error("Styles must be an object");
    }

    // Initialize element registry if needed
    if (!elementStyleRegistry.has(element)) {
      elementStyleRegistry.set(element, new Map());
    }

    const elementControllers = elementStyleRegistry.get(element);

    // Initialize controller styles if needed
    if (!elementControllers.has(name)) {
      elementControllers.set(name, {});
    }

    const controllerStyles = elementControllers.get(name);

    // Update styles for this controller
    Object.assign(controllerStyles, styles);

    // Recompute and apply final styles
    applyFinalStyles(element);
  };

  const get = (element) => {
    if (!elementStyleRegistry.has(element)) {
      return {};
    }

    const elementControllers = elementStyleRegistry.get(element);
    const controllerStyles = elementControllers.get(name);
    return controllerStyles ? { ...controllerStyles } : {};
  };

  const remove = (element, propertyName) => {
    if (!elementStyleRegistry.has(element)) {
      return;
    }

    const elementControllers = elementStyleRegistry.get(element);
    const controllerStyles = elementControllers.get(name);

    if (controllerStyles && propertyName in controllerStyles) {
      delete controllerStyles[propertyName];

      // Clean up empty controller
      if (Object.keys(controllerStyles).length === 0) {
        elementControllers.delete(name);
      }

      // Clean up empty element registry
      if (elementControllers.size === 0) {
        elementStyleRegistry.delete(element);
      }

      // Recompute and apply final styles
      applyFinalStyles(element);
    }
  };

  const commit = (element) => {
    const finalStyles = computeFinalStyles(element);
    const normalizedStyles = normalizeStyles(finalStyles);

    // Apply styles directly as inline styles
    for (const [property, value] of Object.entries(normalizedStyles)) {
      element.style[property] = value;
    }
  };

  const clear = (element) => {
    if (!elementStyleRegistry.has(element)) {
      return;
    }

    const elementControllers = elementStyleRegistry.get(element);
    elementControllers.delete(name);

    // Clean up empty element registry
    if (elementControllers.size === 0) {
      elementStyleRegistry.delete(element);
    }

    // Recompute and apply final styles
    applyFinalStyles(element);
  };

  const destroy = () => {
    // Remove this controller from all elements
    for (const [element, elementControllers] of elementStyleRegistry) {
      if (elementControllers.has(name)) {
        elementControllers.delete(name);

        // Clean up empty element registry
        if (elementControllers.size === 0) {
          elementStyleRegistry.delete(element);
        } else {
          // Recompute styles for remaining controllers
          applyFinalStyles(element);
        }
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
  // Merge styles from all controllers (later controllers override earlier ones)
  for (const [, styles] of elementControllers) {
    finalStyles = mergeStyles(finalStyles, styles);
  }
  return finalStyles;
};

// Apply final computed styles with animation support
const applyFinalStyles = (element) => {
  const finalStyles = computeFinalStyles(element);

  // Cancel existing animation
  if (animationRegistry.has(element)) {
    animationRegistry.get(element).cancel();
  }

  // Normalize styles for DOM application
  const normalizedStyles = normalizeStyles(finalStyles);

  // Create and start synchronous animation (duration: 0)
  const animation = element.animate([normalizedStyles], {
    duration: 0,
    fill: "forwards",
  });

  animationRegistry.set(element, animation);
};
