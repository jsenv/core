export const createHeightAnimationController = (element, options) =>
  createSizeAnimationController(element, {
    getStyle: () => parseFloat(getComputedStyle(element).height),
    setStyle: (value) => {
      element.style.height = `${value}px`;
    },
    getKeyFrames: (target) => {
      return [{ height: `${target}px` }];
    },
    ...options,
  });

// durant l'animation je dois remove min-height sinon c'est moche
const GROW_EASING = "ease-out";
const SHRINK_EASING = "ease-in";
const createSizeAnimationController = (
  element,
  { getStyle, setStyle, getKeyFrames, duration = 300 } = {},
) => {
  let currentAnimation = null;
  const cleanupCurrentAnimation = () => {
    if (currentAnimation) {
      currentAnimation.cancel();
      currentAnimation = null;
    }
  };

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

  const set = (
    target,
    { onFinish, sideEffect, preserveRemainingDuration } = {},
  ) => {
    udpateSideEffect(sideEffect);
    const current = getStyle();
    if (current === target) {
      return;
    }

    if (currentAnimation) {
      currentAnimation.cancel();
      const newAnimation = element.animate(getKeyFrames(target), {
        duration: preserveRemainingDuration
          ? getRemainingDuration(currentAnimation)
          : duration,
        easing: target > current ? GROW_EASING : SHRINK_EASING,
      });
      currentAnimation = newAnimation;
      currentAnimation.onfinish = () => {
        if (currentAnimation === newAnimation) {
          setStyle(target);
          currentAnimation = null;
          cleanupSideEffect();
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

    const animation = element.animate(getKeyFrames(target), {
      duration,
      easing: target > current ? GROW_EASING : SHRINK_EASING,
    });

    currentAnimation = animation;
    currentAnimation.onfinish = () => {
      if (currentAnimation === animation) {
        setStyle(target);
        currentAnimation = null;
        cleanupSideEffect();
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
    set,
    cancel: () => {
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
