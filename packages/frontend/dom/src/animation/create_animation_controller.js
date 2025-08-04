import { cubicBezier } from "@jsenv/animation";
import { getHeight } from "../size/get_height.js";
import { setStyles } from "../style_and_attributes.js";

const easing = (x) => cubicBezier(x, 0.1, 0.4, 0.6, 1.0);

export const createStep = ({
  element,
  property,
  target,
  sideEffect,
  getValue = () => {
    // Default value getters based on property
    if (property === "height") return getHeight(element);
    // Add more property getters as needed
    throw new Error(`No default value getter for property: ${property}`);
  },
  setValue = (value, { timing }) => {
    element.style[property] = `${value}px`;
    // Add special handling for other properties if needed
  },
}) => {
  return {
    element,
    property,
    target,
    sideEffect,
    getValue,
    setValue,
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
    setValue(value, { timing });
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
        const { element, property, target, sideEffect, getValue, setValue } = step;
        const isNew = !elementSet.has(element);
        const startValue = getValue();

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

          element.setAttribute(`data-${property}-animated`, "");
          finishCallbackSet.add(() => {
            element.removeAttribute(`data-${property}-animated`);
          });
          cancelCallbackSet.add(() => {
            element.removeAttribute(`data-${property}-animated`);
          });
        } else {
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
