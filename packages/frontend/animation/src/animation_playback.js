/**
 * Nice to have: support animation.fps that would cap the animation to a certain frame rate.
 */

import { addOnTimeline, removeFromTimeline } from "./animation_timeline.js";
import { cubicBezier } from "./easing.js";

const easingDefault = (x) => cubicBezier(x, 0.1, 0.4, 0.6, 1.0);
export const createTransition = ({
  from,
  to,
  duration,
  easing = easingDefault,
  init,
  effect,
} = {}) => {
  const transition = {
    from,
    to,
    value: from,
    duration,
    easing,
    progress: 0,
    init,
    effect,
  };
  return transition;
};

export const animate = (transition, { isVisual }) => {
  const animation = {
    duration: transition.duration,
    startTime: undefined,
    isVisual,
  };
  const playbackController = createPlaybackController({
    start: () => {
      const cleanup = transition.init?.();
      animation.startTime = document.timeline.currentTime;
      animation.update = playbackController.progress;
      addOnTimeline(animation);
      return {
        update: (progress) => {
          transition.progress = progress;
          if (progress === 1) {
            transition.value = transition.to;
          } else {
            const easedProgress = transition.easing(progress);
            const value =
              transition.from +
              (transition.to - transition.from) * easedProgress;
            transition.value = value;
          }
          transition.effect?.(transition.value);
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
  });
  makePlayable(animation, playbackController);
  return animation;
};

const makePlayable = (content, playbackController) => {
  const { channels, play, progress, pause, cancel, finish } =
    playbackController;
  Object.assign(content, {
    channels,
    play,
    progress,
    pause,
    cancel,
    finish,
    get playState() {
      return playbackController.playState;
    },
    get idle() {
      return playbackController.playState === "idle";
    },
    get running() {
      return playbackController.playState === "running";
    },
    get paused() {
      return playbackController.playState === "paused";
    },
    get finished() {
      return playbackController.playState === "finished";
    },
  });
};

export const createPlaybackController = (content) => {
  const [progressCallbacks, executeProgressCallbacks] =
    createCallbackController();
  const [finishCallbacks, executeFinishCallbacks] = createCallbackController();
  const channels = {
    progress: progressCallbacks,
    finish: finishCallbacks,
  };

  let playState = "idle"; // 'idle', 'running', 'paused', 'finished'
  let contentPlaying = null;
  let resume;
  const playbackController = {
    channels,
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
      executeProgressCallbacks(progress);
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
      executeFinishCallbacks();
    },
  };
  return playbackController;
};
export const createPlaybackGroup = (playableContentArray) => {
  const playbackController = createPlaybackController({
    start: () => {
      const playingCount = playableContentArray.length;
      let finishedCount = 0;

      for (const playableContent of playableContentArray) {
        // eslint-disable-next-line no-loop-func
        const remove = playableContent.channels.finish.add(() => {
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
  });
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
