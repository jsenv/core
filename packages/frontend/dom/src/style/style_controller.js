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

// Global registry to track which controllers are managing each element's styles
const elementControllerSetRegistry = new WeakMap(); // element -> Set<controller>

// Top-level helpers for controller attachment tracking
const onElementControllerAdded = (element, controller) => {
  if (!elementControllerSetRegistry.has(element)) {
    elementControllerSetRegistry.set(element, new Set());
  }
  const elementControllerSet = elementControllerSetRegistry.get(element);
  elementControllerSet.add(controller);
};
const onElementControllerRemoved = (element, controller) => {
  const elementControllerSet = elementControllerSetRegistry.get(element);
  if (elementControllerSet) {
    elementControllerSet.delete(controller);

    // Clean up empty element registry
    if (elementControllerSet.size === 0) {
      elementControllerSetRegistry.delete(element);
    }
  }
};

export const createStyleController = (name = "anonymous") => {
  // Store element data for this controller: element -> { styles, animation }
  const elementWeakMap = new WeakMap();

  const set = (element, stylesToSet) => {
    if (!element || typeof element !== "object") {
      throw new Error("Element must be a valid DOM element");
    }
    if (!stylesToSet || typeof stylesToSet !== "object") {
      throw new Error("styles must be an object");
    }

    const normalizedStylesToSet = normalizeStyles(stylesToSet, "js");
    const elementData = elementWeakMap.get(element);
    if (!elementData) {
      const animation = createAnimationForStyles(
        element,
        normalizedStylesToSet,
        name,
      );
      elementWeakMap.set(element, {
        styles: normalizedStylesToSet,
        animation,
      });
      onElementControllerAdded(element, controller);
      return;
    }

    const { styles, animation } = elementData;
    const mergedStyles = mergeStyles(styles, normalizedStylesToSet);
    elementData.styles = mergedStyles;
    updateAnimationStyles(animation, mergedStyles);
  };

  const get = (element, propertyName) => {
    const elementData = elementWeakMap.get(element);
    if (!elementData) {
      return undefined;
    }
    const { styles } = elementData;
    if (propertyName === undefined) {
      return { ...styles };
    }
    if (propertyName.startsWith("transform.")) {
      const transformProp = propertyName.slice("transform.".length);
      return styles.transform?.[transformProp];
    }
    return styles[propertyName];
  };

  const deleteMethod = (element, propertyName) => {
    const elementData = elementWeakMap.get(element);
    if (!elementData) {
      return;
    }
    const { styles, animation } = elementData;
    const hasStyle = Object.hasOwn(styles, propertyName);
    if (!hasStyle) {
      return;
    }
    delete styles[propertyName];
    const isEmpty = Object.keys(styles).length === 0;
    // Clean up empty controller
    if (isEmpty) {
      animation.cancel();
      elementWeakMap.delete(element);
      onElementControllerRemoved(element, controller);
      return;
    }
    updateAnimationStyles(animation, styles);
  };

  const commit = (element) => {
    const elementData = elementWeakMap.get(element);
    if (!elementData) {
      return; // Nothing to commit on this element for this controller
    }
    const { styles, animation } = elementData;
    // Cancel our animation permanently since we're committing styles to inline
    // (Keep this BEFORE getComputedStyle to prevent computedStyle reading our animation styles)
    animation.cancel();
    // Now read the true underlying styles (without our animation influence)
    const computedStyles = getComputedStyle(element);
    // Convert controller styles to CSS and commit to inline styles
    const cssStyles = normalizeStyles(styles, "css");
    for (const [key, value] of Object.entries(cssStyles)) {
      // Merge with existing computed styles for all properties
      const existingValue = computedStyles[key];
      element.style[key] = mergeOneStyle(existingValue, value, key, "css");
    }
    // Clear this controller's styles since they're now inline
    elementWeakMap.delete(element);
    // Clean up controller from element registry
    onElementControllerRemoved(element, controller);
  };

  const clear = (element) => {
    const elementData = elementWeakMap.get(element);
    if (!elementData) {
      return;
    }
    const { animation } = elementData;
    animation.cancel();
    elementWeakMap.delete(element);
    onElementControllerRemoved(element, controller);
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
      const elementData = elementWeakMap.get(element);
      if (!elementData) {
        return fn();
      }
      const { styles, animation } = elementData;
      // Temporarily cancel our animation to read underlying value
      animation.cancel();
      const underlyingValue = fn();
      // Restore our animation
      elementData.animation = createAnimationForStyles(element, styles, name);
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
      const elementData = elementWeakMap.get(element);
      if (!elementData) {
        continue;
      }
      const { animation } = elementData;
      animation.cancel();
      elementWeakMap.delete(element);
      onElementControllerRemoved(element, controller);
    }
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

  return controller;
};

const createAnimationForStyles = (element, styles, id) => {
  const cssStylesToSet = normalizeStyles(styles, "css");
  const animation = element.animate([cssStylesToSet], {
    duration: 0,
    fill: "forwards",
  });
  animation.id = id; // Set a debug name for this animation
  animation.play();
  animation.pause();
  return animation; // Return the created animation
};

const updateAnimationStyles = (animation, styles) => {
  const cssStyles = normalizeStyles(styles, "css");
  animation.effect.setKeyframes([cssStyles]);
  animation.play();
  animation.pause();
};
