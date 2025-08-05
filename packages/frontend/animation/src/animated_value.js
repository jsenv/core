/**
 * Nice to have: support animation.fps that would cap the animation to a certain frame rate.
 */

import { cubicBezier } from "./easing.js";

const animationSet = new Set();
const addOnTimeline = (animation) => {
  animation.startTime = document.timeline.currentTime;
  animationSet.add(animation);
};
const removeFromTimeline = (animation) => {
  animationSet.delete(animation);
};

const animationCleanupMap = new Map();
let paused = true;

const updateAnimation = (animation) => {
  const { startTime, duration } = animation;
  const elapsed = document.timeline.currentTime - startTime;
  const msRemaining = duration - elapsed;
  if (
    // we reach the end, round progress to 1
    msRemaining < 0 ||
    // we are very close from the end, round progress to 1
    msRemaining <= 16.6
  ) {
    onAnimationFinished(animation);
  } else {
    const progress = Math.min(elapsed / duration, 1);
    onAnimationProgress(animation, progress);
  }
};
const onAnimationProgress = (animation, progress) => {
  const { from, to, easing } = animation;
  const easedProgress = easing(progress);
  const animatedValue = from + (to - from) * easedProgress;
  animation.update({
    progress,
    value: animatedValue,
    timing: "progress",
  });
};
const onAnimationFinished = (animation) => {
  animation.finish();
};

// We need setTimeout to animate things like volume because requestAnimationFrame would be killed when tab is not visible
// while we might want to fadeout volumn when leaving the page for instance
const createBackgroundUpdateLoop = () => {
  let timeout;
  const update = () => {
    for (const animation of animationSet) {
      if (animation.isVisual) {
        continue;
      }
      if (animation.paused) {
        continue;
      }
      updateAnimation(animation);
    }
    timeout = setTimeout(update, 16); // roughly 60fps
  };
  return {
    pause: () => {
      clearTimeout(timeout);
    },
    play: () => {
      timeout = setTimeout(update, 16);
    },
  };
};
// For visual things we use animation frame which is more performant and made for this
const createAnimationFrameLoop = () => {
  let animationFrame = null;
  const update = () => {
    for (const animation of animationSet) {
      if (!animation.isVisual) {
        continue;
      }
      if (animation.paused) {
        continue;
      }
      updateAnimation(animation);
    }
    animationFrame = requestAnimationFrame(update);
  };
  return {
    play: () => {
      animationFrame = requestAnimationFrame(update);
    },
    pause: () => {
      cancelAnimationFrame(animationFrame);
    },
  };
};
const backgroundUpdateLoop = createBackgroundUpdateLoop();
const animationUpdateLoop = createAnimationFrameLoop();

export const pause = () => {
  if (paused) {
    return;
  }
  paused = true;
  backgroundUpdateLoop.play();
  animationUpdateLoop.play();
};
export const play = () => {
  if (!paused) {
    return;
  }
  paused = false;
  backgroundUpdateLoop.play();
  animationUpdateLoop.play();
};
play();

const easingDefault = (x) => cubicBezier(x, 0.1, 0.4, 0.6, 1.0);
export const createAnimatedValue = (
  from,
  to,
  { duration, startTime, currentTime, easing = easingDefault } = {},
) => {
  const start = () => {
    const startReturnValue = animatedValue.onStart();
    if (typeof startReturnValue === "function") {
      animationCleanupMap.set(animatedValue, startReturnValue);
    }
    animatedValue.playState = "running";
    addOnTimeline(animatedValue);
  };

  const animatedValue = {
    duration,
    startTime,
    currentTime,
    from,
    to,
    value: from,
    easing,
    progress: 0,
    update: ({ progress, value }) => {
      animatedValue.progress = progress;
      animatedValue.value = value;
    },
    playState: "idle", // 'idle', 'running', 'paused', 'finished'
    play: () => {
      if (animatedValue.playState === "idle") {
        start();
        return;
      }
      if (animatedValue.playState === "running") {
        console.warn("animation already running");
        return;
      }
      if (animatedValue.playState === "paused") {
        animatedValue.playState = "running";
        addOnTimeline(animatedValue);
        return;
      }
      // "finished"
      start();
    },
    pause: () => {
      if (animatedValue.playState === "paused") {
        console.warn("animation already paused");
        return;
      }
      if (animatedValue.playState === "finished") {
        console.warn("Cannot pause a finished animation");
        return;
      }
      animatedValue.playState = "paused";
      removeFromTimeline(animatedValue);
    },
    finish: () => {
      if (animatedValue.playState === "idle") {
        console.warn("Cannot finish an animation that is idle");
        return;
      }
      if (animatedValue.playState === "finished") {
        console.warn("animation already finished");
        return;
      }
      // "running" or "paused"
      animatedValue.update({
        progress: 1,
        value: to,
        timing: "end",
      });
      animatedValue.playState = "finished";
      removeFromTimeline(animatedValue);
      const cleanup = animationCleanupMap.get(animatedValue);
      if (cleanup) {
        animationCleanupMap.delete(animatedValue);
        cleanup();
      }
    },
  };
  return animatedValue;
};

export const playAnimations = (animations, { onEnd }) => {
  const animationWrapper = {
    cancel: () => {
      for (const animation of animations) {
        animation.onCancel?.();
        removeFromTimeline(animation);
      }
    },
    getAnimationByConstructor: (constructor) => {
      return animations.find(
        (animation) => animation.constructor === constructor,
      );
    },
  };

  let animationPlayingCount = animations.length;
  for (const animation of animations) {
    // eslint-disable-next-line no-loop-func
    animation.onfinish = () => {
      animationPlayingCount--;
      if (animationPlayingCount === 0) {
        animationWrapper.playing = false;
        animationWrapper.ended = true;
        onEnd?.();
      }
    };
    animation.play();
  }

  return animationWrapper;
};
