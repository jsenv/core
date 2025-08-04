import { cubicBezier } from "@jsenv/animation";
import { getHeight } from "../size/get_height.js";
import { getWidth } from "../size/get_width.js";
import { setStyles } from "../style_and_attributes.js";

const easing = (x) => cubicBezier(x, 0.1, 0.4, 0.6, 1.0);

export const createAnimationController = ({ duration: initialDuration }) => {
  let duration = initialDuration;
  const animationSet = new Set();
  let animationFrame;
  let startTime;
  let pauseTime;
  let isPaused = false;

  // Track current animated values per property
  let animatedValues = {};

  const finishCallbackSet = new Set();
  const callFinishCallbacks = () => {
    finishCallbackSet.clear();
    for (const finishCallback of finishCallbackSet) {
      finishCallback();
    }
    cancelCallbackSet.clear();
  };
  const cancelCallbackSet = new Set();
  const callCancelCallbacks = () => {
    finishCallbackSet.clear();
    for (const cancelCallback of cancelCallbackSet) {
      cancelCallback();
    }

    cancelCallbackSet.clear();
  };

  const updateAnimation = (animation, value, { timing }) => {
    const { setValue, element, property, sideEffect } = animation.step;
    setValue(element, value, { timing });
    // Track animated value for this property
    animatedValues[property] = value;
    sideEffect?.(value, { timing });
  };

  const animationController = {
    pending: false,
    isPaused: () => isPaused,
    pause: () => {
      isPaused = true;
    },
    resume: () => {
      isPaused = false;
    },
    setDuration: (newDuration) => {
      duration = newDuration;
    },
    animatedValues,
    animateAll: (stepArray, { onChange, onCancel, onEnd } = {}) => {
      if (onCancel) {
        cancelCallbackSet.add(onCancel);
      }
      if (onEnd) {
        finishCallbackSet.add(onEnd);
      }

      const animationToKillSet = new Set(animationSet);

      let somethingChanged = false;
      for (const step of stepArray) {
        const element = step.element;
        const targetValue = step.target;
        const property = step.property;
        const subproperty = step.subproperty;
        const startValue = step.getValue(element);

        if (animationSet.size) {
          let existingAnimation;
          for (const animation of animationSet) {
            if (
              animation.step.element === element &&
              animation.step.property === property &&
              animation.step.subproperty === subproperty
            ) {
              // If we're already animating this property, update it
              existingAnimation = animation;
              animationToKillSet.delete(animation);
              break;
            }
          }

          if (existingAnimation) {
            if (startValue === targetValue) {
              // nothing to do, same element, same property, same target
              continue;
            }
            // update the animation target
            existingAnimation.targetValue = targetValue;
            existingAnimation.startValue = startValue;
            somethingChanged = true;
            continue;
          }
        }

        const valueDiff = Math.abs(startValue - targetValue);
        const minDiff = property === "opacity" ? 0.1 : 10;
        const propertyName = subproperty
          ? `${property}.${subproperty}`
          : property;
        if (valueDiff === 0) {
          console.warn(
            `Animation of "${propertyName}" is unnecessary: start and target values are identical (${startValue})`,
            { element },
          );
        } else if (valueDiff < minDiff) {
          console.warn(
            `Animation of "${propertyName}" might be too subtle: change of ${valueDiff} is below recommended threshold of ${minDiff}`,
            { element, from: startValue, to: targetValue },
          );
        }

        somethingChanged = true;
        animationSet.add({
          step,
          targetValue,
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

      for (const animationToKill of animationToKillSet) {
        animationSet.delete(animationToKill);
      }

      if (somethingChanged) {
        startTime = document.timeline.currentTime;
      }

      animationController.pending = true;

      let timing = "start";
      const draw = () => {
        if (isPaused) {
          if (!pauseTime) {
            pauseTime = document.timeline.currentTime - startTime;
          }
          animationFrame = requestAnimationFrame(draw);
          return;
        }

        // If resuming from pause, adjust startTime to preserve progress
        if (pauseTime) {
          startTime = document.timeline.currentTime - pauseTime;
          pauseTime = null;
        }

        const elapsed = document.timeline.currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        if (progress < 1) {
          const easedProgress = easing(progress);
          const changeEntryArray = [];
          for (const animation of animationSet) {
            const startValue = animation.startValue;
            const targetValue = animation.targetValue;
            const property = animation.step.property;
            const animatedValue =
              startValue + (targetValue - startValue) * easedProgress;
            updateAnimation(animation, animatedValue, { timing });
            changeEntryArray.push({
              element: animation.step.element,
              property,
              subproperty: animation.step.subproperty,
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
        for (const animation of animationSet) {
          const element = animation.step.element;
          const property = animation.step.property;
          const finalValue = animation.targetValue;
          updateAnimation(animation, finalValue, { timing });
          animation.completed = true;
          changeEntryArray.push({
            element,
            property,
            subproperty: animation.step.subproperty,
            value: finalValue,
          });
        }
        if (changeEntryArray.length && onChange) {
          onChange(changeEntryArray, true);
        }
        animationController.pending = false;
        callFinishCallbacks();
        animationSet.clear();
        animatedValues = {};
        animationFrame = null;
        pauseTime = null;
      };

      animationFrame = requestAnimationFrame(draw);
    },
    cancel: () => {
      animationController.pending = false;
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
      animatedValues = {};
      pauseTime = null;
      isPaused = false;
      callFinishCallbacks();
      callCancelCallbacks();
    },
  };
  return animationController;
};

const parseTransform = (transform) => {
  if (!transform || transform === "none") return new Map();
  const transformMap = new Map();

  if (transform.startsWith("matrix(")) {
    // matrix(a, b, c, d, e, f) where e is translateX and f is translateY
    const values = transform
      .match(/matrix\((.*?)\)/)?.[1]
      .split(",")
      .map(Number);
    if (values) {
      const translateX = values[4]; // e value from matrix
      transformMap.set("translateX", { value: translateX, unit: "px" });
      return transformMap;
    }
  }

  // For direct transform functions (when set via style.transform)
  const matches = transform.matchAll(/(\w+)\(([-\d.]+)(%|px|deg)?\)/g);
  for (const match of matches) {
    const [, func, value, unit = ""] = match;
    transformMap.set(func, { value: parseFloat(value), unit });
  }
  return transformMap;
};

const stringifyTransform = (transformMap) => {
  if (transformMap.size === 0) return "none";
  return Array.from(transformMap.entries())
    .map(([func, { value, unit }]) => `${func}(${value}${unit})`)
    .join(" ");
};

const createTranslateXStep = ({ element, target, unit = "px", sideEffect }) => {
  const getValue = (element) => {
    const transform = getComputedStyle(element).transform;
    const transformMap = parseTransform(transform);
    return transformMap.get("translateX")?.value || 0;
  };

  const setValue = (element, value) => {
    const transform = getComputedStyle(element).transform;
    const transformMap = parseTransform(transform);
    transformMap.set("translateX", { value, unit });
    const transformString = stringifyTransform(transformMap);
    element.style.transform = transformString;
  };

  return {
    element,
    property: "transform",
    subproperty: "translateX",
    target,
    getValue,
    setValue,
    sideEffect,
  };
};

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
  // Check for transform functions in the property or target
  if (property === "transform" && target.includes("translateX")) {
    const match = target.match(/translateX\(([-\d.]+)(%|px)?\)/);
    if (match) {
      const unit = match[2] || "px";
      return createTranslateXStep({
        element,
        target: parseFloat(match[1]),
        unit,
        sideEffect,
      });
    }
  }

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
