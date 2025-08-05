/**
 * Nice to have: support animation.fps that would cap the animation to a certain frame rate.
 */

import { addOnTimeline, removeFromTimeline } from "./animation_timeline.js";
import { EASING } from "./easing.js";

// Default lifecycle methods that do nothing
const LIFECYCLE_DEFAULT = {
  setup: () => {},
  pause: () => {},
  cancel: () => {},
  finish: () => {},
  updateTarget: () => {},
};

export const createTransition = ({
  constructor,
  key,
  from,
  to,
  duration,
  easing = EASING.EASE_OUT,
  lifecycle = LIFECYCLE_DEFAULT,
  onProgress,
} = {}) => {
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
  let isFirstUpdate = false;
  let resume;
  let executionLifecycle = null;

  const start = () => {
    isFirstUpdate = true;
    playState = "running";

    executionLifecycle = lifecycle.setup(transition);

    // Allow setup to override from value if transition.from is undefined
    if (
      transition.from === undefined &&
      executionLifecycle.from !== undefined
    ) {
      transition.from = executionLifecycle.from;
    }

    const diff = Math.abs(transition.to - transition.from);
    if (diff === 0) {
      console.warn(
        `transition has identical from and to values (${transition.from}px). This transition will have no effect.`,
      );
    } else if (diff < 10) {
      console.warn(
        `transition difference is very small (${diff}px). Consider if this transition is necessary.`,
      );
    }
  };

  const transition = {
    constructor,
    key,
    from,
    to,
    value: from,
    duration,
    progress: 0,
    timing: "",
    easing,
    channels,
    get playState() {
      return playState;
    },

    play: () => {
      if (playState === "idle") {
        start();
        return;
      }
      if (playState === "running") {
        console.warn("transition already running");
        return;
      }
      if (playState === "paused") {
        playState = "running";
        resume();
        return;
      }
      // "finished"
      start();
    },

    update: (progress) => {
      if (playState === "idle") {
        console.warn("Cannot progress transition that is idle");
        return;
      }
      if (playState === "finished") {
        console.warn("Cannot progress a finished transition");
        return;
      }
      // "running" or "paused"
      transition.progress = progress;
      if (progress === 1) {
        transition.value = transition.to;
      } else {
        const easedProgress = transition.easing(progress);
        const value =
          transition.from + (transition.to - transition.from) * easedProgress;
        transition.value = value;
      }
      transition.timing =
        progress === 1 ? "end" : isFirstUpdate ? "start" : "progress";
      executionLifecycle.update(transition.value);
      isFirstUpdate = false;
      executeProgressCallbacks(transition);
      if (progress === 1) {
        transition.finish();
      }
    },

    pause: () => {
      if (playState === "paused") {
        console.warn("transition already paused");
        return;
      }
      if (playState === "finished") {
        console.warn("Cannot pause a finished transition");
        return;
      }
      playState = "paused";

      // Let the transition handle its own pause logic
      resume = lifecycle.pause(transition);
    },

    cancel: () => {
      if (executionLifecycle) {
        lifecycle.cancel(transition);
        executionLifecycle.teardown();
        executionLifecycle.restore();
      }
      resume = null;
      playState = "idle";
    },

    finish: () => {
      if (playState === "idle") {
        console.warn("Cannot finish a transition that is idle");
        return;
      }
      if (playState === "finished") {
        console.warn("transition already finished");
        return;
      }
      // "running" or "paused"
      lifecycle.finish(transition);
      executionLifecycle.teardown();
      resume = null;
      playState = "finished";
      executeFinishCallbacks();
    },

    updateTarget: (newTarget) => {
      if (
        typeof newTarget !== "number" ||
        isNaN(newTarget) ||
        !isFinite(newTarget)
      ) {
        throw new Error(
          `updateTarget: newTarget must be a finite number, got ${newTarget}`,
        );
      }
      if (playState === "idle") {
        console.warn("Cannot update target of idle transition");
        return;
      }
      if (playState === "finished") {
        console.warn("Cannot update target of finished transition");
        return;
      }
      const currentValue = transition.value;
      transition.from = currentValue;
      transition.to = newTarget;

      // Let the transition handle its own target update logic
      lifecycle.updateTarget(transition);
    },
  };

  return transition;
};

// Timeline-managed transition that adds/removes itself from the animation timeline
export const createTimelineTransition = ({
  constructor,
  key,
  from,
  to,
  duration,
  easing = EASING.EASE_OUT,
  setup,
  isVisual,
  onProgress,
} = {}) => {
  return createTransition({
    constructor,
    key,
    from,
    to,
    duration,
    easing,
    onProgress,
    lifecycle: {
      setup: (transition) => {
        // Handle timeline management
        transition.startTime = document.timeline.currentTime;
        addOnTimeline(transition, isVisual);
        // Call the original setup
        return setup();
      },
      pause: (transition) => {
        const pauseTime = document.timeline.currentTime;
        removeFromTimeline(transition);
        return () => {
          const pausedDuration = document.timeline.currentTime - pauseTime;
          transition.startTime += pausedDuration;
          addOnTimeline(transition, isVisual);
        };
      },
      cancel: (transition) => {
        removeFromTimeline(transition, isVisual);
      },
      finish: (transition) => {
        removeFromTimeline(transition, isVisual);
      },
      updateTarget: (transition) => {
        transition.startTime = document.timeline.currentTime;
      },
    },
  });
};

// Group transition that manages multiple animations
export const createGroupTransition = (transitionArray) => {
  const progressValues = new Array(transitionArray.length).fill(0);
  const finishedStates = new Array(transitionArray.length).fill(false);

  return createTransition({
    from: 0,
    to: 1,
    duration: 0,
    easing: (x) => x,
    lifecycle: {
      setup: (transition) => {
        progressValues.fill(0);
        finishedStates.fill(false);

        // Start all transitions and track their progress
        transitionArray.forEach((childTransition, index) => {
          const removeProgressListener = childTransition.channels.progress.add(
            (content) => {
              progressValues[index] = content.progress;
              // Calculate average progress
              const averageProgress =
                progressValues.reduce((sum, p) => sum + p, 0) /
                transitionArray.length;

              // Update this transition's progress
              transition.update(averageProgress);
            },
          );

          const removeFinishListener = childTransition.channels.finish.add(
            () => {
              removeProgressListener();
              removeFinishListener();
              progressValues[index] = 1;
              finishedStates[index] = true;

              // Check if all transitions are finished
              const allFinished = finishedStates.every((finished) => finished);
              if (allFinished) {
                transition.finish();
              }
            },
          );

          childTransition.play();
        });

        return {
          update: () => {},
          teardown: () => {},
          restore: () => {},
        };
      },
      pause: () => {
        for (const childTransition of transitionArray) {
          if (childTransition.playState === "running") {
            childTransition.pause();
          }
        }
        return () => {
          for (const childTransition of transitionArray) {
            if (childTransition.playState === "paused") {
              childTransition.play();
            }
          }
        };
      },

      cancel: () => {
        for (const childTransition of transitionArray) {
          if (childTransition.playState !== "idle") {
            childTransition.cancel();
          }
        }
      },

      finish: () => {
        for (const childTransition of transitionArray) {
          if (childTransition.playState !== "finished") {
            childTransition.finish();
          }
        }
      },
    },
  });
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

// Group multiple transitions together
export const groupTransitions = (transitionArray) => {
  return createGroupTransition(transitionArray);
};
