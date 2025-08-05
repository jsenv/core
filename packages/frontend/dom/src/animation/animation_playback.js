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
  { isVisual, constructor, key, targetValue, onProgress },
) => {
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
  let transition = null;
  let isFirstUpdate = false;
  let resume;
  let startTime = null;

  const animation = {
    channels,
    constructor,
    key,
    targetValue,
    get playState() {
      return playState;
    },
    get content() {
      return transition;
    },
    get startTime() {
      return startTime;
    },
    set startTime(value) {
      startTime = value;
    },
    get duration() {
      return transition?.duration || 0;
    },
    get isVisual() {
      return isVisual;
    },
    update: null, // Will be set to progress method

    play: (...args) => {
      if (playState === "idle") {
        isFirstUpdate = true;
        playState = "running";
        transition = transitionProducer(...args);
        startTime = document.timeline.currentTime;

        const { update, teardown, restore } = transition.setup();
        addOnTimeline(animation);

        animation._update = update;
        animation._teardown = teardown;
        animation._restore = restore;
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
      isFirstUpdate = true;
      playState = "running";
      transition = transitionProducer(...args);
      startTime = document.timeline.currentTime;

      const { update, teardown, restore } = transition.setup();
      addOnTimeline(animation);

      animation._update = update;
      animation._teardown = teardown;
      animation._restore = restore;
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

      animation._update(transition.value);
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
      const pauseTime = document.timeline.currentTime;
      removeFromTimeline(animation);
      resume = () => {
        const pausedDuration = document.timeline.currentTime - pauseTime;
        startTime = startTime + pausedDuration;
        addOnTimeline(animation);
      };
    },

    cancel: () => {
      if (transition) {
        removeFromTimeline(animation);
        animation._teardown();
        animation._restore();
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
      removeFromTimeline(animation);
      animation._teardown();
      resume = null;
      playState = "finished";
      executeFinishCallbacks();
    },

    resetStartTime: () => {
      startTime = document.timeline.currentTime;
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
      // Update the transition target and reset timing
      const currentValue = transition.value;
      transition.updateTarget(currentValue, newTarget);
      animation.resetStartTime();
    },
  };

  // Set the update method reference
  animation.update = animation.progress;

  return animation;
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
export const animateGroup = (animationArray) => {
  const [progressCallbacks, executeProgressCallbacks] =
    createCallbackController();
  const [finishCallbacks, executeFinishCallbacks] = createCallbackController();
  const channels = {
    progress: progressCallbacks,
    finish: finishCallbacks,
  };

  let playState = "idle";
  const playingCount = animationArray.length;
  const progressValues = new Array(playingCount).fill(0);
  const finishedStates = new Array(playingCount).fill(false);

  // Create a group transition for tracking overall progress
  const groupTransition = createTransition({
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

  const animationGroup = {
    channels,
    get playState() {
      return playState;
    },
    get content() {
      return groupTransition;
    },

    play: (...args) => {
      if (playState === "running") {
        console.warn("animation group already running");
        return;
      }

      playState = "running";
      progressValues.fill(0);
      finishedStates.fill(false);

      // Start all animations and track their progress
      animationArray.forEach((animation, index) => {
        // Track progress updates from each animation
        const removeProgressListener = animation.channels.progress.add(
          (content) => {
            progressValues[index] = content.progress;
            // Calculate average progress
            const averageProgress =
              progressValues.reduce((sum, p) => sum + p, 0) / playingCount;

            // Update group transition
            groupTransition.progress = averageProgress;
            groupTransition.value = averageProgress;
            groupTransition.timing = averageProgress === 1 ? "end" : "progress";

            executeProgressCallbacks(groupTransition);
          },
        );

        // Track when animations finish
        const removeFinishListener = animation.channels.finish.add(() => {
          removeProgressListener();
          removeFinishListener();
          progressValues[index] = 1;
          finishedStates[index] = true;

          // Check if all animations are finished
          const allFinished = finishedStates.every((finished) => finished);
          if (allFinished) {
            playState = "finished";
            executeFinishCallbacks();
          }
        });

        animation.play(...args);
      });
    },

    pause: () => {
      if (playState !== "running") {
        console.warn("Cannot pause animation group that is not running");
        return;
      }
      playState = "paused";
      for (const animation of animationArray) {
        if (animation.playState === "running") {
          animation.pause();
        }
      }
    },

    cancel: () => {
      playState = "idle";
      for (const animation of animationArray) {
        if (animation.playState !== "idle") {
          animation.cancel();
        }
      }
    },

    finish: () => {
      if (playState === "idle") {
        console.warn("Cannot finish animation group that is idle");
        return;
      }
      playState = "finished";
      for (const animation of animationArray) {
        if (animation.playState !== "finished") {
          animation.finish();
        }
      }
    },
  };

  return animationGroup;
};
