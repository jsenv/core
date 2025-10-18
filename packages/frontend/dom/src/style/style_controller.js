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

// Helper function to handle transform parsing in mergeStyles
const parseTransformIfNeeded = (value) => {
  if (typeof value === "string" && value !== "none") {
    return parseTransformString(value);
  }
  return value;
};

// Enhanced mergeStyles that handles transform strings
const mergeStylesWithTransformSupport = (target, source) => {
  const processedSource = {};

  for (const [key, value] of Object.entries(source)) {
    if (key === "transform") {
      processedSource[key] = parseTransformIfNeeded(value);
    } else {
      processedSource[key] = value;
    }
  }

  const processedTarget = {};
  for (const [key, value] of Object.entries(target)) {
    if (key === "transform") {
      processedTarget[key] = parseTransformIfNeeded(value);
    } else {
      processedTarget[key] = value;
    }
  }

  return mergeStyles(processedTarget, processedSource);
};

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
    const mergedStyles = mergeStylesWithTransformSupport(
      controllerStyles,
      styles,
    );
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
    const existingStyles = getExistingStyles(element);

    // Merge existing styles with new styles (composable properties like transform)
    const composedStyles = mergeStylesWithTransformSupport(
      existingStyles,
      finalStyles,
    );
    const normalizedStyles = normalizeStyles(composedStyles);

    for (const [key, value] of Object.entries(normalizedStyles)) {
      element.style[key] = value;
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

// Get existing styles from element, parsing transform strings into objects
const getExistingStyles = (element) => {
  const computedStyles = getComputedStyle(element);
  const existingStyles = {};

  // Only consider properties that we might want to compose
  const composableProperties = ["transform"];

  for (const property of composableProperties) {
    const value = computedStyles[property];
    if (value && value !== "none") {
      if (property === "transform") {
        // Parse transform string into object
        existingStyles[property] = parseTransformString(value);
      } else {
        existingStyles[property] = value;
      }
    }
  }

  return existingStyles;
};

// Parse transform CSS string into object
const parseTransformString = (transformString) => {
  const transformObj = {};

  if (!transformString || transformString === "none") {
    return transformObj;
  }

  // Simple regex to parse transform functions
  const transformPattern = /(\w+)\(([^)]+)\)/g;
  let match;

  while ((match = transformPattern.exec(transformString)) !== null) {
    const [, functionName, value] = match;
    transformObj[functionName] = value.trim();
  }

  return transformObj;
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
    finalStyles = mergeStylesWithTransformSupport(
      finalStyles,
      controllerStyles,
    );
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
