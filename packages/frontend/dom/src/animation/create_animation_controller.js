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
  const startValueMap = new Map();
  const targetValueMap = new Map();
  const propertyMap = new Map();
  const setValueMap = new Map();
  const sideEffectMap = new Map();
  const elementSet = new Set();
  let animationFrame;
  let startTime;

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

  const update = (element, value, { timing }) => {
    const setValue = setValueMap.get(element);
    setValue(element, value, { timing });
    const sideEffect = sideEffectMap.get(element);
    if (sideEffect) {
      sideEffect(value, { timing });
    }
  };

  const animationController = {
    pending: false,
    animateAll: (stepArray, { onChange } = {}) => {
      let somethingChanged = false;
      for (const step of stepArray) {
        const { element, property, target, sideEffect, getValue, setValue } =
          step;
        const isNew = !elementSet.has(element);
        const startValue = getValue(element);

        if (isNew) {
          if (startValue === target) {
            continue;
          }
          somethingChanged = true;
          elementSet.add(element);
          startValueMap.set(element, startValue);
          targetValueMap.set(element, target);
          propertyMap.set(element, property);
          setValueMap.set(element, setValue);
          sideEffectMap.set(element, sideEffect);

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
        } else {
          const valueDiff = Math.abs(startValue - target);
          const minDiff = property === "opacity" ? 0.1 : 10;
          if (valueDiff < minDiff) {
            console.warn(
              `Animation of "${property}" might be unnecessary: change of ${valueDiff} is very small (min recommended: ${minDiff})`,
              { element, from: startValue, to: target },
            );
          }
          if (startValue !== target || targetValueMap.get(element) !== target) {
            somethingChanged = true;
          }
          startValueMap.set(element, startValue);
          targetValueMap.set(element, target);
          propertyMap.set(element, property);
          setValueMap.set(element, setValue);
          sideEffectMap.set(element, sideEffect);
        }
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
          for (const element of elementSet) {
            const startValue = startValueMap.get(element);
            const targetValue = targetValueMap.get(element);
            const animatedValue =
              startValue + (targetValue - startValue) * easedProgress;
            update(element, animatedValue, { timing });
            changeEntryArray.push({
              element,
              property: propertyMap.get(element),
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
        for (const element of elementSet) {
          const finalValue = targetValueMap.get(element);
          update(element, finalValue, { timing });
          changeEntryArray.push({
            element,
            property: propertyMap.get(element),
            value: finalValue,
          });
        }
        if (changeEntryArray.length && onChange) {
          onChange(changeEntryArray, true);
        }
        callFinishCallbacks();
        startValueMap.clear();
        targetValueMap.clear();
        propertyMap.clear();
        setValueMap.clear();
        sideEffectMap.clear();
        elementSet.clear();
        animationFrame = null;
        animationController.pending = false;
      };

      animationFrame = requestAnimationFrame(draw);
    },
    cancel: () => {
      animationController.pending = false;
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
      callFinishCallbacks();
      callCancelCallbacks();
    },
  };
  return animationController;
};
