/**
 * Creates a style controller for managing CSS styles with animation support.
 *
 * Features:
 * - Multiple controllers can manage styles on the same element
 * - Automatic garbage collection via WeakMap when elements are garbage collected
 * - Web Animations API integration for smooth transitions
 * - Conflict resolution between controllers
 */

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

    // Apply styles directly as inline styles
    for (const [property, value] of Object.entries(finalStyles)) {
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
function computeFinalStyles(element) {
  if (!elementStyleRegistry.has(element)) {
    return {};
  }

  const elementControllers = elementStyleRegistry.get(element);
  const finalStyles = {};

  // Merge styles from all controllers (later controllers override earlier ones)
  for (const [, styles] of elementControllers) {
    Object.assign(finalStyles, styles);
  }

  return finalStyles;
}

// Apply final computed styles with animation support
function applyFinalStyles(element) {
  const finalStyles = computeFinalStyles(element);
  const currentStyles = getCurrentStyles(element);

  // Find properties that need to be animated
  const animatableProperties = getAnimatableProperties(
    currentStyles,
    finalStyles,
  );

  if (animatableProperties.length > 0) {
    animateStyleChanges(
      element,
      currentStyles,
      finalStyles,
      animatableProperties,
    );
  } else {
    // Apply styles directly if no animation needed
    for (const [property, value] of Object.entries(finalStyles)) {
      element.style[property] = value;
    }
  }
}

// Get current computed styles for animatable properties
function getCurrentStyles(element) {
  const computed = getComputedStyle(element);
  const styles = {};

  // Only track properties that we're managing
  if (elementStyleRegistry.has(element)) {
    const finalStyles = computeFinalStyles(element);
    for (const property of Object.keys(finalStyles)) {
      styles[property] = computed[property];
    }
  }

  return styles;
}

// Determine which properties can be animated
function getAnimatableProperties(currentStyles, finalStyles) {
  const animatableProps = new Set([
    "opacity",
    "transform",
    "color",
    "backgroundColor",
    "borderColor",
    "width",
    "height",
    "left",
    "top",
    "right",
    "bottom",
  ]);

  const animatable = [];
  for (const property of Object.keys(finalStyles)) {
    if (
      animatableProps.has(property) &&
      currentStyles[property] !== finalStyles[property]
    ) {
      animatable.push(property);
    }
  }
  return animatable;
}

// Animate style changes using Web Animations API
function animateStyleChanges(
  element,
  currentStyles,
  finalStyles,
  animatableProperties,
) {
  // Cancel existing animation
  if (animationRegistry.has(element)) {
    animationRegistry.get(element).cancel();
  }

  // Create keyframes for animation
  const startState = {};
  const endState = {};

  for (const prop of animatableProperties) {
    startState[prop] = currentStyles[prop];
    endState[prop] = finalStyles[prop];
  }

  const keyframes = [startState, endState];

  // Create and start animation
  const animation = element.animate(keyframes, {
    duration: 200,
    easing: "ease-out",
    fill: "forwards",
  });

  animationRegistry.set(element, animation);

  // Clean up when animation completes
  animation.addEventListener("finish", () => {
    animationRegistry.delete(element);

    // Apply final styles to ensure consistency
    for (const [property, value] of Object.entries(finalStyles)) {
      element.style[property] = value;
    }
  });

  // Apply non-animatable styles immediately
  for (const [property, value] of Object.entries(finalStyles)) {
    if (!animatableProperties.includes(property)) {
      element.style[property] = value;
    }
  }
}
