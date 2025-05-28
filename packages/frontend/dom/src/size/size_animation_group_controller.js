import { cubicBezier } from "@jsenv/animation";
import { setStyles } from "../style_and_attributes.js";

const easing = (x) => cubicBezier(x, 0.1, 0.4, 0.6, 1.0);

export const createSizeAnimationGroupController = ({ duration }) => {
  const startSizeMap = new Map();
  const targetSizeMap = new Map();
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
    animateAll: (animations, { onChange }) => {
      let somethingChanged = false;
      for (const { element, target, sideEffect } of animations) {
        const isNew = !elementSet.has(element);
        const startSize = parseFloat(getComputedStyle(element).height);
        if (isNew) {
          if (startSize === target) {
            continue;
          }
          somethingChanged = true;
          elementSet.add(element);
          startSizeMap.set(element, startSize);
          targetSizeMap.set(element, target);
          sideEffectMap.set(element, sideEffect);
          const restoreWillChangeStyle = setStyles(element, {
            "will-change": "height",
          });
          finishCallbackSet.add(restoreWillChangeStyle);
          const restoreSizeStyle = setStyles(element, {
            height: `${startSize}px`,
          });
          cancelCallbackSet.add(restoreSizeStyle);
        } else {
          if (startSize !== target || targetSizeMap.get(element) !== target) {
            somethingChanged = true;
          }
          startSizeMap.set(element, startSize);
          targetSizeMap.set(element, target);
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
            const startSize = startSizeMap.get(element);
            const targetSize = targetSizeMap.get(element);
            const animatedSize =
              startSize + (targetSize - startSize) * easedProgress;
            update(element, animatedSize);
            changeEntryArray.push({ element, value: animatedSize });
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
          const finalSize = targetSizeMap.get(element);
          update(element, finalSize, true);
          changeEntryArray.push({ element, value: finalSize });
        }
        if (changeEntryArray.length && onChange) {
          onChange(changeEntryArray);
        }
        callFinishCallbacks();
        startSizeMap.clear();
        targetSizeMap.clear();
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
