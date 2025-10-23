import { cubicBezier } from "@jsenv/animation";
import { getHeight } from "../size/get_height.js";
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

  const update = (element, value, { timing }) => {
    element.style.height = `${value}px`;
    const sideEffect = sideEffectMap.get(element);
    if (sideEffect) {
      sideEffect(value, { timing });
    }
  };

  const animationGroupController = {
    pending: false,
    animateAll: (animations, { onChange }) => {
      let somethingChanged = false;
      for (const { element, target, sideEffect } of animations) {
        const isNew = !elementSet.has(element);
        const startSize = getHeight(element);
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

          element.setAttribute("data-size-animated", "");
          finishCallbackSet.add(() => {
            element.removeAttribute("data-size-animated");
          });
          cancelCallbackSet.add(() => {
            element.removeAttribute("data-size-animated");
          });
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

      animationGroupController.pending = true;

      let timing = "start";
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
            update(element, animatedSize, { timing });
            changeEntryArray.push({ element, value: animatedSize });
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
          const finalSize = targetSizeMap.get(element);
          update(element, finalSize, { timing });
          changeEntryArray.push({ element, value: finalSize });
        }
        if (changeEntryArray.length && onChange) {
          onChange(changeEntryArray, true);
        }
        callFinishCallbacks();
        startSizeMap.clear();
        targetSizeMap.clear();
        sideEffectMap.clear();
        elementSet.clear();
        animationFrame = null;
        animationGroupController.pending = false;
      };

      animationFrame = requestAnimationFrame(draw);
    },
    cancel: () => {
      animationGroupController.pending = false;
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
      callFinishCallbacks();
      callCancelCallbacks();
    },
  };
  return animationGroupController;
};
