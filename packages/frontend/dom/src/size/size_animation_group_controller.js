import { cubicBezier } from "@jsenv/animation";
import { setStyles } from "../style_and_attributes.js";

const easing = (x) => cubicBezier(x, 0.1, 0.4, 0.6, 1.0);

export const createSizeAnimationGroupController = ({ duration, onChange }) => {
  const startHeightMap = new Map();
  const targetHeightMap = new Map();
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

  const update = (element, value, isFinished) => {
    element.style.height = `${value}px`;
    const sideEffect = sideEffectMap.get(element);
    if (sideEffect) {
      sideEffect(value, isFinished);
    }
  };

  return {
    animateAll: (animations) => {
      let somethingChanged = false;
      for (const { element, target, sideEffect } of animations) {
        const isNew = !elementSet.has(element);
        if (isNew) {
          const startHeight = parseFloat(getComputedStyle(element).height);
          if (startHeight === target) {
            continue;
          }
          somethingChanged = true;
          elementSet.add(element);
          startHeightMap.set(element, startHeight);
          targetHeightMap.set(element, target);
          sideEffectMap.set(element, sideEffect);
          const restoreWillChangeStyle = setStyles(element, {
            "will-change": "height",
          });
          finishCallbackSet.add(restoreWillChangeStyle);
          const restoreHeightStyle = setStyles(element, {
            height: `${startHeight}px`,
          });

          cancelCallbackSet.add(restoreHeightStyle);
        } else {
          const currentHeight = parseFloat(getComputedStyle(element).height);
          if (
            currentHeight !== target ||
            targetHeightMap.get(element) !== target
          ) {
            somethingChanged = true;
          }
          startHeightMap.set(element, currentHeight);
          targetHeightMap.set(element, target);
          sideEffectMap.set(element, sideEffect);
        }
      }
      if (somethingChanged) {
        startTime = document.timeline.currentTime;
      }

      const draw = () => {
        const elapsed = document.timeline.currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        if (progress < 1) {
          const easedProgress = easing(progress);
          const changeEntryArray = [];
          for (const element of elementSet) {
            const startHeight = startHeightMap.get(element);
            const targetHeight = targetHeightMap.get(element);
            const currentHeight =
              startHeight + (targetHeight - startHeight) * easedProgress;
            update(element, currentHeight);
            changeEntryArray.push({ element, value: startHeight });
          }
          if (changeEntryArray.length && onChange) {
            onChange(changeEntryArray);
          }
          animationFrame = requestAnimationFrame(draw);
          return;
        }

        // Animation complete
        const changeEntryArray = [];
        for (const element of elementSet) {
          const finalHeight = targetHeightMap.get(element);
          update(element, finalHeight, true);
          changeEntryArray.push({ element, value: finalHeight });
        }
        if (changeEntryArray.length && onChange) {
          onChange(changeEntryArray);
        }
        callFinishCallbacks();
        startHeightMap.clear();
        targetHeightMap.clear();
        sideEffectMap.clear();
        elementSet.clear();
        animationFrame = null;
      };

      animationFrame = requestAnimationFrame(draw);
    },
    cancel: () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
      callFinishCallbacks();
      callCancelCallbacks();
    },
  };
};
