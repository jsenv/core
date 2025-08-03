import { setStyles } from "../style_and_attributes.js";

const DEBUG = false;

export const createSizeAnimationController = (
  element,
  {
    duration = 300,
    widthEnabled = true,
    heightEnabled = true,
    ...options
  } = {},
) =>
  createStyleAnimationController(element, {
    getStyle: () => ({
      width: parseFloat(getComputedStyle(element).width),
      height: parseFloat(getComputedStyle(element).height),
    }),
    setStyle: ({ width, height }) => {
      if (widthEnabled) element.style.width = `${width}px`;
      if (heightEnabled) element.style.height = `${height}px`;
    },
    getKeyFrames: (target) => {
      return [
        {
          ...(widthEnabled ? { width: `${target.width}px` } : {}),
          ...(heightEnabled ? { height: `${target.height}px` } : {}),
        },
      ];
    },
    setup: () => {
      return setStyles(element, {
        ...(widthEnabled ? { "min-width": 0 } : {}),
        ...(heightEnabled ? { "min-height": 0 } : {}),
      });
    },
    compareStyle: (a, b) => {
      if (widthEnabled && a.width !== b.width) return false;
      if (heightEnabled && a.height !== b.height) return false;
      return true;
    },
    getEasing: (current, target) => {
      if (!heightEnabled) {
        return target.width > current.width ? GROW_EASING : SHRINK_EASING;
      }
      if (!widthEnabled) {
        return target.height > current.height ? GROW_EASING : SHRINK_EASING;
      }
      // When both dimensions are enabled, base easing on the dimension with the bigger change
      const widthDiff = Math.abs(target.width - current.width);
      const heightDiff = Math.abs(target.height - current.height);
      if (widthDiff > heightDiff) {
        return target.width > current.width ? GROW_EASING : SHRINK_EASING;
      }
      return target.height > current.height ? GROW_EASING : SHRINK_EASING;
    },
    duration,
    ...options,
  });

export const createHeightAnimationController = (element, options) =>
  createSizeAnimationController(element, {
    widthEnabled: false,
    heightEnabled: true,
    ...options,
  });

export const createWidthAnimationController = (element, options) =>
  createSizeAnimationController(element, {
    widthEnabled: true,
    heightEnabled: false,
    ...options,
  });

const GROW_EASING = "ease-out";
const SHRINK_EASING = "ease-in";
const createStyleAnimationController = (
  element,
  {
    getStyle,
    setStyle,
    getKeyFrames,
    setup,
    duration = 300,
    compareStyle = (a, b) => a === b,
    getEasing,
  } = {},
) => {
  let currentAnimation = null;
  const cleanupCurrentAnimation = () => {
    if (currentAnimation) {
      currentAnimation.cancel();
      currentAnimation = null;
    }
  };

  let teardown = null;

  let raf;
  const cleanupSideEffect = () => {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = null;
    }
  };
  const udpateSideEffect = (sideEffect) => {
    cleanupSideEffect();
    if (!sideEffect) {
      return;
    }
    const next = () => {
      raf = requestAnimationFrame(() => {
        const size = getStyle();
        sideEffect(size);
        next();
      });
    };
    next();
  };

  const animateTo = (
    target,
    { onFinish, sideEffect, preserveRemainingDuration, easing } = {},
  ) => {
    udpateSideEffect(sideEffect);
    const current = getStyle();
    if (compareStyle(current, target)) {
      return;
    }

    if (currentAnimation) {
      currentAnimation.cancel();
      const newAnimation = element.animate(
        [...getKeyFrames(current), ...getKeyFrames(target)],
        {
          duration: preserveRemainingDuration
            ? getRemainingDuration(currentAnimation)
            : duration,
          easing:
            easing || (getEasing ? getEasing(current, target) : GROW_EASING),
        },
      );
      currentAnimation = newAnimation;
      currentAnimation.onfinish = () => {
        if (currentAnimation === newAnimation) {
          setStyle(target);
          currentAnimation = null;
          cleanupSideEffect();
          element.removeAttribute("data-animated");
          if (teardown) {
            teardown();
            teardown = null;
          }
          onFinish?.(target);
        }
      };
      currentAnimation.oncancel = () => {
        if (currentAnimation === newAnimation) {
          cleanupSideEffect();
          currentAnimation = null;
        }
      };
      return;
    }

    if (DEBUG) {
      console.debug(
        `animateTo(${JSON.stringify(target)}) on element ${element.tagName}`,
      );
    }

    const animation = element.animate(getKeyFrames(target), {
      duration,
      easing: easing || (getEasing ? getEasing(current, target) : GROW_EASING),
    });
    if (setup) {
      const setupReturnValue = setup();
      if (typeof setupReturnValue === "function") {
        teardown = setupReturnValue;
      }
    }
    element.setAttribute("data-animated", "");
    currentAnimation = animation;
    currentAnimation.onfinish = () => {
      if (currentAnimation === animation) {
        setStyle(target);
        currentAnimation = null;
        cleanupSideEffect();
        element.removeAttribute("data-animated");
        if (teardown) {
          teardown();
          teardown = null;
        }
        onFinish?.(target);
      }
    };
    currentAnimation.oncancel = () => {
      if (currentAnimation === animation) {
        cleanupSideEffect();
        currentAnimation = null;
      }
    };
  };

  return {
    animateTo,
    cancel: () => {
      if (teardown) {
        teardown();
        teardown = null;
      }
      cleanupSideEffect();
      cleanupCurrentAnimation();
    },
  };
};

const getRemainingDuration = (animation) => {
  const animDuration = animation.effect.getTiming().duration;
  const currentTime = animation.currentTime || 0;
  const progress = Math.min(currentTime / animDuration, 1);
  const remainingDuration = animDuration * (1 - progress);
  return remainingDuration;
};
