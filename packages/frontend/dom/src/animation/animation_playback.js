/**
 * Nice to have: support animation.fps that would cap the animation to a certain frame rate.
 */

import { addOnTimeline, removeFromTimeline } from "./animation_timeline.js";
import { EASING } from "./easing.js";

const INCREASE_EASING = EASING.EASE_OUT;
const DECREASE_EASING = EASING.EASE_OUT;

export const createTransition = ({
  from,
  to,
  duration,
  easing,
  setup,
} = {}) => {
  const transition = {
    from,
    to,
    value: from,
    duration,
    progess: 0,
    timing: "",
    easing:
      easing === undefined
        ? to > from
          ? INCREASE_EASING
          : DECREASE_EASING
        : easing,
    setup,
    updateTarget: (newFrom, newTo) => {
      if (typeof newFrom !== "number" || isNaN(newFrom) || !isFinite(newFrom)) {
        throw new Error(
          `updateTarget: newFrom must be a finite number, got ${newFrom}`,
        );
      }
      if (typeof newTo !== "number" || isNaN(newTo) || !isFinite(newTo)) {
        throw new Error(
          `updateTarget: newTo must be a finite number, got ${newTo}`,
        );
      }
      transition.from = newFrom;
      transition.to = newTo;
      if (easing === undefined) {
        transition.easing =
          transition.to > transition.from ? INCREASE_EASING : DECREASE_EASING;
      }
    },
  };
  return transition;
};

export const animate = (
  transitionProducer,
  { isVisual, constructor, key, to, onProgress },
) => {
  const playbackController = createPlaybackController(
    {
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

        const hooks = {
          resetStartTime: () => {
            animation.startTime = document.timeline.currentTime;
          },
          updateTarget: (to) => {
            const currentValue = transition.value;
            transition.updateTarget(currentValue, to);
            hooks.resetStartTime();
          },
          update: (progress, { isFirstUpdate }) => {
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
            transition.timing =
              progress === 1 ? "end" : isFirstUpdate ? "start" : "progress";
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

        return [transition, hooks];
      },
    },
    {
      onProgress,
    },
  );

  // Add metadata to the controller
  playbackController.constructor = constructor;
  playbackController.key = key;
  playbackController.to = to;

  return playbackController;
};

export const createPlaybackController = (content, { onProgress } = {}) => {
  const [progressCallbacks, executeProgressCallbacks] =
    createCallbackController();
  const [finishCallbacks, executeFinishCallbacks] = createCallbackController();
  const channels = {
    progress: progressCallbacks,
    finish: finishCallbacks,
  };
  if (onProgress) {
    progressCallbacks.add(onProgress);
  }

  let playState = "idle"; // 'idle', 'running', 'paused', 'finished'
  let contentPlaying = null;
  let contentHooks = null;
  let isFirstUpdate = false;
  let resume;
  const playbackController = {
    channels,
    playState,
    play: (...args) => {
      if (playState === "idle") {
        isFirstUpdate = true;
        playState = playbackController.playState = "running";
        [contentPlaying, contentHooks] = content.start(...args);
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
      isFirstUpdate = true;
      playState = playbackController.playState = "running";
      [contentPlaying, contentHooks] = content.start(...args);
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
      contentHooks.update(progress, { isFirstUpdate });
      isFirstUpdate = false;
      executeProgressCallbacks(contentPlaying);
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
      resume = contentHooks.pause();
    },
    cancel: () => {
      if (contentPlaying) {
        contentHooks.cancel();
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
      contentHooks.finish();
      resume = null;
      playState = playbackController.playState = "finished";
      executeFinishCallbacks();
    },

    resetStartTime: () => {
      contentHooks.resetStartTime();
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
      if (contentHooks && contentHooks.updateTarget) {
        contentHooks.updateTarget(newTarget);
        contentHooks.resetStartTime();
      }
    },

    get content() {
      return contentPlaying;
    },
  };
  return playbackController;
};
export const createPlaybackGroup = (playableContentArray) => {
  const playbackController = createPlaybackController({
    start: () => {
      // Create a transition to manage group progress and timing
      const groupTransition = createTransition({
        from: 0,
        to: 1,
        duration: 0, // Duration doesn't matter for group progress tracking
        easing: (x) => x, // Linear for group progress
        setup: () => ({
          update: () => {}, // No direct DOM updates for group transition
          teardown: () => {},
          restore: () => {},
        }),
      });

      const playingCount = playableContentArray.length;
      const progressValues = new Array(playingCount).fill(0);
      const finishedStates = new Array(playingCount).fill(false);

      // Start all animations and track their progress
      playableContentArray.forEach((playableContent, index) => {
        // Track progress updates from each animation
        const removeProgressListener = playableContent.channels.progress.add(
          (content) => {
            progressValues[index] = content.progress;
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

      const groupHooks = {
        pause: () => {
          for (const playableContent of playableContentArray) {
            if (playableContent.playState !== "finished") {
              playableContent.pause();
            }
          }
        },
        update: (progress, { isFirstUpdate }) => {
          // Update group transition timing based on playback controller state
          groupTransition.progress = progress;
          groupTransition.value = progress;
          groupTransition.timing =
            progress === 1 ? "end" : isFirstUpdate ? "start" : "progress";
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
        updateTarget: () => {
          // Groups don't support updateTarget - individual animations handle this
          console.warn("updateTarget not supported on animation groups");
        },
      };

      return [groupTransition, groupHooks];
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
