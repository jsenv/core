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
  setup,
} = {}) => {
  const transition = {
    from,
    to,
    value: from,
    duration,
    easing,
    progress: 0,
    setup,
  };
  return transition;
};

export const animate = (transitionProducer, { isVisual }) => {
  const playbackController = createPlaybackController({
    start: (...args) => {
      const transition = transitionProducer(...args);
      const animation = {
        transition,
        startTime: document.timeline.currentTime,
        duration: transition.duration,
        isVisual,
        update: playbackController.progress,
      };
      const { update, teardown, restore } = transition.setup();
      addOnTimeline(animation);

      const content = {
        transition,
        resetStartTime: () => {
          animation.startTime = document.timeline.currentTime;
        },
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
          update(transition.value);
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
          teardown();
          restore();
        },
        finish: () => {
          removeFromTimeline(animation);
          teardown();
        },
      };

      return content;
    },
  });
  return playbackController;
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
    play: (...args) => {
      if (playState === "idle") {
        playState = playbackController.playState = "running";
        contentPlaying = content.start(...args);
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
      contentPlaying = content.start(...args);
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

    resetStartTime: () => {
      contentPlaying.resetStartTime();
    },
    updateTarget: (newTarget) => {
      if (playState === "idle") {
        console.warn("Cannot update target of idle content");
        return;
      }
      if (playState === "finished") {
        console.warn("Cannot update target of finished content");
        return;
      }
      // Update the transition target and reset timing
      if (contentPlaying && contentPlaying.transition) {
        contentPlaying.transition.from = contentPlaying.transition.value;
        contentPlaying.transition.to = newTarget;
        contentPlaying.resetStartTime();
      }
    },
  };
  return playbackController;
};
export const createPlaybackGroup = (playableContentArray) => {
  const playbackController = createPlaybackController({
    start: () => {
      const playingCount = playableContentArray.length;
      const progressValues = new Array(playingCount).fill(0);
      const finishedStates = new Array(playingCount).fill(false);

      // Start all animations and track their progress
      playableContentArray.forEach((playableContent, index) => {
        // Track progress updates from each animation
        const removeProgressListener = playableContent.channels.progress.add(
          (progress) => {
            progressValues[index] = progress;
            // Calculate average progress
            const averageProgress =
              progressValues.reduce((sum, p) => sum + p, 0) / playingCount;
            // Only call progress if we haven't finished yet
            if (averageProgress < 1) {
              playbackController.progress(averageProgress);
            }
          },
        );

        // Track when animations finish
        const removeFinishListener = playableContent.channels.finish.add(() => {
          removeProgressListener();
          removeFinishListener();
          progressValues[index] = 1;
          finishedStates[index] = true;

          // Check if all animations are finished
          const allFinished = finishedStates.every((finished) => finished);
          if (allFinished) {
            playbackController.progress(1);
          }
        });

        playableContent.play();
      });

      return {
        pause: () => {
          for (const playableContent of playableContentArray) {
            if (playableContent.playState !== "finished") {
              playableContent.pause();
            }
          }
        },
        update: () => {
          // noop - progress is handled by individual animation listeners
        },
        cancel: () => {
          for (const playableContent of playableContentArray) {
            if (playableContent.playState !== "finished") {
              playableContent.cancel();
            }
          }
        },
        finish: () => {
          for (const playableContent of playableContentArray) {
            if (playableContent.playState !== "finished") {
              playableContent.finish();
            }
          }
        },
        resetStartTime: () => {
          for (const playableContent of playableContentArray) {
            if (
              playableContent.resetStartTime &&
              playableContent.playState !== "finished"
            ) {
              playableContent.resetStartTime();
            }
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
