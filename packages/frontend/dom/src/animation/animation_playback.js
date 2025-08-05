/**
 * Nice to have: support animation.fps that would cap the animation to a certain frame rate.
 */

import { addOnTimeline, removeFromTimeline } from "./animation_timeline.js";
import { EASING } from "./easing.js";

export const createTransition = ({
  constructor,
  key,
  from,
  to,
  duration,
  easing = EASING.EASE_OUT,
  setup,
} = {}) => {
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
    setup,
    // Default lifecycle methods that do nothing
    lifecycle: {
      start: () => {},
      pause: () => {},
      cancel: () => {},
      finish: () => {},
      updateTarget: () => {},
    },
  };
  return transition;
};

// Base animation that handles common animation logic
export const animate = (transition, { onProgress } = {}) => {
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
  let teardown = null;
  let update = null;
  let restore = null;

  const start = () => {
    isFirstUpdate = true;
    playState = "running";

    const setupResult = transition.setup();
    update = setupResult.update;
    teardown = setupResult.teardown;
    restore = setupResult.restore;

    const from = transition.from;
    const to = transition.to;
    // Warn if the animation difference is too small
    const diff = Math.abs(to - from);
    if (diff === 0) {
      console.warn(
        `transition has identical from and to values (${from}px). This transition will have no effect.`,
      );
    } else if (diff < 10) {
      console.warn(
        `transition difference is very small (${diff}px). Consider if this transition is necessary.`,
      );
    }

    // Let the transition manage its own lifecycle
    transition.lifecycle.start(animation);
  };

  const animation = {
    transition,
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
        console.warn("animation already running");
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

    progress: (progress) => {
      if (playState === "idle") {
        console.warn("Cannot progress animation that is idle");
        return;
      }
      if (playState === "finished") {
        console.warn("Cannot progress a finished animation");
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
      update(transition.value);
      isFirstUpdate = false;
      executeProgressCallbacks(transition);
      if (progress === 1) {
        animation.finish();
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
      playState = "paused";

      // Let the transition handle its own pause logic
      resume = transition.lifecycle.pause(animation);
    },

    cancel: () => {
      if (transition) {
        transition.lifecycle.cancel(animation);
        teardown();
        restore();
      }
      resume = null;
      playState = "idle";
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
      transition.lifecycle.finish(animation);
      teardown();
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
        console.warn("Cannot update target of idle animation");
        return;
      }
      if (playState === "finished") {
        console.warn("Cannot update target of finished animation");
        return;
      }
      const currentValue = transition.value;
      transition.from = currentValue;
      transition.to = newTarget;

      // Let the transition handle its own target update logic
      transition.lifecycle.updateTarget(animation);
    },
  };

  return animation;
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
  isVisual = true,
} = {}) => {
  const transition = createTransition({
    constructor,
    key,
    from,
    to,
    duration,
    easing,
    setup,
  });

  // Add timeline management hooks
  transition.isVisual = isVisual;
  transition.lifecycle = {
    start: (animation) => {
      animation.startTime = document.timeline.currentTime;
      addOnTimeline(animation);
    },
    pause: (animation) => {
      const pauseTime = document.timeline.currentTime;
      removeFromTimeline(animation);
      return () => {
        const pausedDuration = document.timeline.currentTime - pauseTime;
        animation.startTime += pausedDuration;
        addOnTimeline(animation);
      };
    },
    cancel: (animation) => {
      removeFromTimeline(animation);
    },
    finish: (animation) => {
      removeFromTimeline(animation);
    },
    updateTarget: (animation) => {
      animation.startTime = document.timeline.currentTime;
    },
  };
  return transition;
};

// Group transition that manages multiple animations
export const createGroupTransition = (animationArray) => {
  const progressValues = new Array(animationArray.length).fill(0);
  const finishedStates = new Array(animationArray.length).fill(false);

  const transition = createTransition({
    from: 0,
    to: 1,
    duration: 0,
    easing: (x) => x,
    setup: () => ({
      update: () => {},
      teardown: () => {},
      restore: () => {},
    }),
  });

  transition.lifecycle = {
    start: (animation) => {
      progressValues.fill(0);
      finishedStates.fill(false);

      // Start all animations and track their progress
      animationArray.forEach((childAnimation, index) => {
        const removeProgressListener = childAnimation.channels.progress.add(
          (content) => {
            progressValues[index] = content.progress;
            // Calculate average progress
            const averageProgress =
              progressValues.reduce((sum, p) => sum + p, 0) /
              animationArray.length;

            // Update this transition's progress
            animation.progress(averageProgress);
          },
        );

        const removeFinishListener = childAnimation.channels.finish.add(() => {
          removeProgressListener();
          removeFinishListener();
          progressValues[index] = 1;
          finishedStates[index] = true;

          // Check if all animations are finished
          const allFinished = finishedStates.every((finished) => finished);
          if (allFinished) {
            animation.finish();
          }
        });

        childAnimation.play();
      });
    },

    pause: () => {
      for (const childAnimation of animationArray) {
        if (childAnimation.playState === "running") {
          childAnimation.pause();
        }
      }
      return () => {
        for (const childAnimation of animationArray) {
          if (childAnimation.playState === "paused") {
            childAnimation.play();
          }
        }
      };
    },

    cancel: () => {
      for (const childAnimation of animationArray) {
        if (childAnimation.playState !== "idle") {
          childAnimation.cancel();
        }
      }
    },

    finish: () => {
      for (const childAnimation of animationArray) {
        if (childAnimation.playState !== "finished") {
          childAnimation.finish();
        }
      }
    },
  };

  return transition;
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

// Simplified animateGroup using group transition
export const animateGroup = (animationArray) => {
  const groupTransition = createGroupTransition(animationArray);
  return animate(groupTransition);
};
