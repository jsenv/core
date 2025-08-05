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
  const playbackController = createPlaybackController({
    start: () => {
      const startReturnValue = animatedValue.onStart();
      addOnTimeline(animatedValue);
      return {
        pause: () => {
          removeFromTimeline(animatedValue);
          return () => {
            addOnTimeline(animatedValue);
          };
        },
        finish: () => {
          removeFromTimeline(animatedValue);
          if (typeof startReturnValue === "function") {
            startReturnValue();
          }
        },
        stop: () => {
          if (typeof startReturnValue === "function") {
            startReturnValue();
          }
        },
      };
    },
  });

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
    get playState() {
      return playbackController.playState;
    },
    play: playbackController.play,
    pause: playbackController.pause,
    finish: playbackController.finish,
    finishCallbacks: playbackController.finishCallbacks,
  };
  return animatedValue;
};

const createPlaybackController = (playableContent) => {
  const [finishCallbacks, executeFinishCallbacks] = createCallbackController();

  let playState = "idle"; // 'idle', 'running', 'paused', 'finished'
  let contentPlaying = null;
  let resume;
  const playbackController = {
    playState,
    play: () => {
      if (playState === "idle") {
        contentPlaying = playableContent.start();
        return;
      }
      if (playState === "running") {
        console.warn("animation already running");
        return;
      }
      if (playState === "paused") {
        playState = playbackController.playState = "running";
        resume();
        return;
      }
      // "finished"
      contentPlaying = playableContent.start();
    },
    pause: () => {
      if (playState === "paused") {
        console.warn("animation already paused");
        return;
      }
      if (playState === "finished") {
        console.warn("Cannot pause a finished animation");
        return;
      }
      playState = playbackController.playState = "paused";
      resume = contentPlaying.pause();
    },
    finish: () => {
      if (playState === "idle") {
        console.warn("Cannot finish an animation that is idle");
        return;
      }
      if (playState === "finished") {
        console.warn("animation already finished");
        return;
      }
      // "running" or "paused"
      resume = null;
      playState = playbackController.playState = "finished";
      contentPlaying.finish();
      executeFinishCallbacks();
    },
    finishCallbacks,
  };

  return playbackController;
};
const createCallbackController = () => {
  const callbackSet = new Set();
  const execute = (...args) => {
    for (const callback of callbackSet) {
      callback(...args);
    }
  };
  const callbacks = {
    add: (callback) => {
      if (typeof callback !== "function") {
        throw new TypeError("Callback must be a function");
      }
      callbackSet.add(callback);
      return () => {
        callbackSet.delete(callback);
      };
    },
  };
  return [callbacks, execute];
};

export const createAnimationController = (animations) => {
  const [finishCallbacks, executeFinishCallbacks] = createCallbackController();

  const playbackController = createPlaybackController({
    start: () => {
      let animationPlayingCount = animations.length;

      for (const animation of animations) {
        // eslint-disable-next-line no-loop-func
        const remove = animation.finishCallbacks.add(() => {
          remove();
          animationPlayingCount--;
          if (animationPlayingCount === 0) {
            executeFinishCallbacks();
          }
        });
        animation.play();
      }
      return {
        pause: () => {
          for (const animation of animations) {
            animation.pause();
          }
        },
        finish: () => {
          for (const animation of animations) {
            animation.finish();
          }
        },
        stop: () => {
          for (const animation of animations) {
            animation.stop();
          }
        },
      };
    },
  });
  const animation = {
    get playState() {
      return playbackController.playState;
    },
    play: playbackController.play,
    pause: playbackController.pause,
    finish: playbackController.finish,
    finishCallbacks,
  };

  return animation;
};
