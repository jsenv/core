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
    animation.update(1);
  } else {
    const progress = Math.min(elapsed / duration, 1);
    animation.update(progress);
  }
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

let paused = true;
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

const playableSymbol = Symbol.for("jsenv_playable_content");
const easingDefault = (x) => cubicBezier(x, 0.1, 0.4, 0.6, 1.0);
export const createAnimatedValue = (
  from,
  to,
  { duration, startTime, currentTime, easing = easingDefault, init } = {},
) => {
  const [finishCallbacks, executeFinishCallbacks] = createCallbackController();
  const [progressCallbacks, executeProgressCallbacks] =
    createCallbackController();
  const animatedValue = {
    from,
    to,
    value: from,
    easing,
    progress: 0,
    animation: null,
    [playableSymbol]: null,

    progressCallbacks,
    finishCallbacks,
  };
  const animation = {
    duration,
    startTime: startTime || document.timeline.currentTime,
    currentTime,
  };
  const playbackController = createPlaybackController(
    {
      start: () => {
        const cleanup = init?.();
        animation.update = playbackController.progress;
        addOnTimeline(animation);
        return {
          update: (progress) => {
            animatedValue.progress = progress;
            if (progress === 1) {
              animatedValue.value = to;
            } else {
              const easedProgress = easing(progress);
              const animatedValue = from + (to - from) * easedProgress;
              animatedValue.value = animatedValue;
            }
          },
          pause: () => {
            removeFromTimeline(animation);
            return () => {
              addOnTimeline(animation);
            };
          },
          abort: () => {
            removeFromTimeline(animation);
            if (typeof cleanup === "function") {
              cleanup();
            }
          },
          finish: () => {
            removeFromTimeline(animation);
            if (typeof cleanup === "function") {
              cleanup();
            }
          },
        };
      },
    },
    {
      onFinish: executeFinishCallbacks,
      onProgress: executeProgressCallbacks,
    },
  );

  animatedValue.animation = animation;
  animatedValue[playableSymbol] = playbackController;

  return animatedValue;
};

export const createPlaybackController = (content, { onProgress, onFinish }) => {
  const [finishCallbacks, executeFinishCallbacks] = createCallbackController();

  let playState = "idle"; // 'idle', 'running', 'paused', 'finished'
  let contentPlaying = null;
  let resume;
  const playbackController = {
    playState,
    play: () => {
      if (playState === "idle") {
        contentPlaying = content.start(playbackController);
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
      contentPlaying = content.start(playbackController);
    },
    progress: (progress) => {
      if (playState === "idle") {
        console.warn("Cannot update an animation that is idle");
        return;
      }
      if (playState === "finished") {
        console.warn("Cannot update a finished animation");
        return;
      }
      // "running" or "paused"
      contentPlaying.update(progress);
      onProgress?.();
      if (progress === 1) {
        playbackController.finish();
      }
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
      contentPlaying.finish();
      resume = null;
      playState = playbackController.playState = "finished";
      onFinish?.();
      executeFinishCallbacks();
    },
    abort: () => {
      if (contentPlaying) {
        contentPlaying.abort();
      }
      resume = null;
      playState = playbackController.playState = "idle";
    },
    finishCallbacks,
  };
  playbackController[playableSymbol] = playbackController;
  return playbackController;
};
export const createPlaybackGroup = (
  playableContentArray,
  { onProgress, onFinish },
) => {
  const playbackController = createPlaybackController(
    {
      start: () => {
        const playingCount = playableContentArray.length;
        let finishedCount = 0;

        playableContentArray = playableContentArray.map((value) => {
          return value[playableSymbol];
        });

        for (const playableContent of playableContentArray) {
          // eslint-disable-next-line no-loop-func
          const remove = playableContent.finishCallbacks.add(() => {
            remove();
            finishedCount++;
            const progress = finishedCount / playingCount;
            playbackController.progress(progress);
          });
          playableContent.play();
        }
        return {
          pause: () => {
            for (const playableContent of playableContentArray) {
              playableContent.pause();
            }
          },
          update: () => {
            // noop
          },
          finish: () => {
            for (const playableContent of playableContentArray) {
              playableContent.finish();
            }
          },
          abort: () => {
            for (const playableContent of playableContentArray) {
              playableContent.abort();
            }
          },
        };
      },
    },
    {
      onProgress,
      onFinish,
    },
  );
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
