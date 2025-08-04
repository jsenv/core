import { cubicBezier } from "@jsenv/animation";
import { getHeight } from "../size/get_height.js";
import { getWidth } from "../size/get_width.js";
import { setStyles } from "../style_and_attributes.js";

const easing = (x) => cubicBezier(x, 0.1, 0.4, 0.6, 1.0);

const KNOWN_PROPERTIES = {
  height: {
    getValue: (element) => getHeight(element),
    setValue: (element, value) => {
      element.style.height = `${value}px`;
    },
  },
  width: {
    getValue: (element) => getWidth(element),
    setValue: (element, value) => {
      element.style.width = `${value}px`;
    },
  },
  opacity: {
    getValue: (element) => parseFloat(getComputedStyle(element).opacity) || 0,
    setValue: (element, value) => {
      element.style.opacity = value;
    },
  },
};

export const createStep = ({ element, property, target, sideEffect }) => {
  const propertyConfig = KNOWN_PROPERTIES[property];
  if (!propertyConfig) {
    throw new Error(
      `Unknown property: ${property}. Use createCustomStep for custom properties.`,
    );
  }

  const { getValue, setValue } = propertyConfig;

  return {
    element,
    property,
    target,
    getValue,
    setValue,
    sideEffect,
  };
};

export const createCustomStep = ({
  element,
  name,
  target,
  getValue,
  setValue,
  sideEffect,
}) => {
  if (!getValue || !setValue) {
    throw new Error("getValue and setValue are required for custom steps");
  }

  return {
    element,
    property: name,
    target,
    getValue,
    setValue,
    sideEffect,
  };
};

export const createAnimationController = ({ duration }) => {
  const runningAnimations = new Set();
  let animationFrame;
  let startTime;

  // Track current animated values per property
  let animatedValues = {};

  const finishCallbackSet = new Set();
  const callFinishCallbacks = () => {
    for (const finishCallback of finishCallbackSet) {
      finishCallback();
    }
    finishCallbackSet.clear();
  };
  const cancelCallbackSet = new Set();
  const callCancelCallbacks = () => {
    for (const cancelCallback of cancelCallbackSet) {
      cancelCallback();
    }
    cancelCallbackSet.clear();
  };

  const updateAnimation = (animation, value, { timing }) => {
    const { setValue, element, property, sideEffect } = animation;
    setValue(element, value, { timing });
    // Track animated value for this property
    animatedValues[property] = value;
    sideEffect?.(value, { timing });
  };

  const animationController = {
    pending: false,
    animatedValues,
    animateAll: (stepArray, { onChange, onEnd } = {}) => {
      let somethingChanged = false;
      for (const step of stepArray) {
        const element = step.element;
        const target = step.target;
        const property = step.property;
        const startValue = step.getValue(element);

        let existingAnimation;
        for (const runningAnimation of runningAnimations) {
          if (
            runningAnimation.element === element &&
            runningAnimation.property === property
          ) {
            // If we're already animating this property, update it
            existingAnimation = runningAnimation;
            break;
          }
        }

        if (existingAnimation) {
          if (startValue === target) {
            // nothing to do, same element, same property, same target
            continue;
          }
          // update the animation target
          existingAnimation.target = target;
          somethingChanged = true;
          continue;
        }

        const valueDiff = Math.abs(startValue - target);
        const minDiff = property === "opacity" ? 0.1 : 10;
        if (valueDiff < minDiff) {
          console.warn(
            `Animation of "${property}" might be unnecessary: change of ${valueDiff} is very small (min recommended: ${minDiff})`,
            { element, from: startValue, to: target },
          );
        }

        somethingChanged = true;
        runningAnimations.add({
          ...step,
          startValue,
          completed: false,
        });

        const restoreWillChangeStyle = setStyles(element, {
          "will-change": property,
        });
        finishCallbackSet.add(restoreWillChangeStyle);

        // Store current value as inline style
        const restoreValueStyle = setStyles(element, {
          [property]: `${startValue}px`,
        });
        cancelCallbackSet.add(restoreValueStyle);

        element.setAttribute(`data-animated`, "");
        element.setAttribute(`data-${property}-animated`, "");
        finishCallbackSet.add(() => {
          element.removeAttribute(`data-animated`);
          element.removeAttribute(`data-${property}-animated`);
        });
        cancelCallbackSet.add(() => {
          element.removeAttribute(`data-animated`);
          element.removeAttribute(`data-${property}-animated`);
        });
      }
      if (somethingChanged) {
        startTime = document.timeline.currentTime;
      }

      animationController.pending = true;

      let timing = "start";
      const draw = () => {
        const elapsed = document.timeline.currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        if (progress < 1) {
          const easedProgress = easing(progress);
          const changeEntryArray = [];
          for (const animation of runningAnimations) {
            const startValue = animation.startValue;
            const targetValue = animation.target;
            const property = animation.property;
            const animatedValue =
              startValue + (targetValue - startValue) * easedProgress;
            updateAnimation(animation, animatedValue, { timing });
            changeEntryArray.push({
              element: animation.element,
              property,
              value: animatedValue,
            });
          }
          timing = "progress";
          if (changeEntryArray.length && onChange) {
            onChange(changeEntryArray);
          }
          animationFrame = requestAnimationFrame(draw);
          return;
        }

        // Animation complete
        timing = "end";
        const changeEntryArray = [];
        for (const animation of runningAnimations) {
          const element = animation.element;
          const property = animation.property;
          const finalValue = animation.target;
          updateAnimation(animation, finalValue, { timing });
          animation.completed = true;
          changeEntryArray.push({
            element,
            property,
            value: finalValue,
          });
        }
        if (changeEntryArray.length && onChange) {
          onChange(changeEntryArray, true);
        }
        callFinishCallbacks();
        runningAnimations.clear();
        animatedValues = {};
        animationFrame = null;
        animationController.pending = false;
        onEnd?.();
      };

      animationFrame = requestAnimationFrame(draw);
    },
    cancel: () => {
      animationController.pending = false;
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
      animatedValues = {};
      callFinishCallbacks();
      callCancelCallbacks();
    },
  };
  return animationController;
};
