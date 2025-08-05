/**
 * Nice to have: support animation.fps that would cap the animation to a certain frame rate.
 */

import { cubicBezier } from "./easing.js";

const animationSet = new Set();
const addOnTimeline = (animation) => {
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
      updateAnimation(animation);
    }
    timeout = setTimeout(update, 16); // roughly 60fps
  };
  return {
    start: () => {
      timeout = setTimeout(update, 16);
    },
    stop: () => {
      clearTimeout(timeout);
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
      updateAnimation(animation);
    }
    animationFrame = requestAnimationFrame(update);
  };
  return {
    start: () => {
      animationFrame = requestAnimationFrame(update);
    },
    stop: () => {
      cancelAnimationFrame(animationFrame);
    },
  };
};
const backgroundUpdateLoop = createBackgroundUpdateLoop();
const animationUpdateLoop = createAnimationFrameLoop();

let timelineIsRunning = false;
export const stopTimeline = () => {
  if (!timelineIsRunning) {
    return;
  }
  timelineIsRunning = false;
  backgroundUpdateLoop.stop();
  animationUpdateLoop.stop();
};
export const startTimeline = () => {
  if (timelineIsRunning) {
    return;
  }
  timelineIsRunning = true;
  backgroundUpdateLoop.start();
  animationUpdateLoop.start();
};
startTimeline();

const easingDefault = (x) => cubicBezier(x, 0.1, 0.4, 0.6, 1.0);
export const createAnimatedValue = (
  from,
  to,
  {
    duration,
    startTime,
    currentTime,
    isVisual,
    easing = easingDefault,
    init,
    onProgress,
    onFinish,
  } = {},
) => {
  const [finishCallbacks, executeFinishCallbacks] = createCallbackController();
  const [progressCallbacks, executeProgressCallbacks] =
    createCallbackController();
  if (onProgress) {
    progressCallbacks.add(() => {
      onProgress(animatedValue);
    });
  }
  if (onFinish) {
    finishCallbacks.add(onFinish);
  }

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
    startTime,
    currentTime,
    isVisual,
  };
  const playbackController = createPlaybackController(
    {
      start: () => {
        const cleanup = init?.();
        animation.startTime = document.timeline.currentTime;
        animation.update = playbackController.progress;
        addOnTimeline(animation);
        return {
          update: (progress) => {
            animatedValue.progress = progress;
            if (progress === 1) {
              animatedValue.value = to;
            } else {
              const easedProgress = easing(progress);
              const value = from + (to - from) * easedProgress;
              animatedValue.value = value;
            }
          },
          pause: () => {
            const pauseTime = document.timeline.currentTime;
            removeFromTimeline(animation);
            return () => {
              const pausedDuration = document.timeline.currentTime - pauseTime;
              animation.startTime = animation.startTime + pausedDuration;

              addOnTimeline(animation);
            };
          },
          cancel: () => {
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
  makePlayable(animatedValue, playbackController);

  return animatedValue;
};

const makePlayable = (content, playbackController) => {
  const { play, progress, pause, cancel, finish } = playbackController;
  Object.assign(content, {
    play,
    progress,
    pause,
    cancel,
    finish,
    get playState() {
      return playbackController.playState;
    },
  });
};

const playableSymbol = Symbol.for("jsenv_playable_content");
export const createPlaybackController = (content, { onProgress, onFinish }) => {
  const [finishCallbacks, executeFinishCallbacks] = createCallbackController();

  let playState = "idle"; // 'idle', 'running', 'paused', 'finished'
  let contentPlaying = null;
  let resume;
  const playbackController = {
    playState,
    play: () => {
      if (playState === "idle") {
        playState = playbackController.playState = "running";
        contentPlaying = content.start(playbackController);
        return;
      }
      if (playState === "running") {
        console.warn("content already running");
        return;
      }
      if (playState === "paused") {
        playState = playbackController.playState = "running";
        resume();
        return;
      }
      // "finished"
      playState = playbackController.playState = "running";
      contentPlaying = content.start(playbackController);
    },
    progress: (progress) => {
      if (playState === "idle") {
        console.warn("Cannot progress content that is idle");
        return;
      }
      if (playState === "finished") {
        console.warn("Cannot progress a finished content");
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
        console.warn("content already paused");
        return;
      }
      if (playState === "finished") {
        console.warn("Cannot pause a finished content");
        return;
      }
      playState = playbackController.playState = "paused";
      resume = contentPlaying.pause();
    },
    cancel: () => {
      if (contentPlaying) {
        contentPlaying.cancel();
      }
      resume = null;
      playState = playbackController.playState = "idle";
    },
    finish: () => {
      if (playState === "idle") {
        console.warn("Cannot finish a content that is idle");
        return;
      }
      if (playState === "finished") {
        console.warn("content already finished");
        return;
      }
      // "running" or "paused"
      contentPlaying.finish();
      resume = null;
      playState = playbackController.playState = "finished";
      onFinish?.();
      executeFinishCallbacks();
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
          cancel: () => {
            for (const playableContent of playableContentArray) {
              playableContent.cancel();
            }
          },
          finish: () => {
            for (const playableContent of playableContentArray) {
              playableContent.finish();
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
