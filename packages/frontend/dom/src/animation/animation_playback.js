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
  };
  return transition;
};

export const animate = (transition, { onProgress }) => {
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

  let isFirstUpdate = false;
  let resume;

  const resetStartTime = () => {
    animation.startTime = document.timeline.currentTime;
  };
  let teardown = null;
  let update = null;
  let restore = null;
  const start = () => {
    isFirstUpdate = true;
    animation.playState = "running";
    animation.startTime = document.timeline.currentTime;

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
    addOnTimeline(animation);
  };

  const animation = {
    transition,
    channels,
    playState: "idle", // 'idle', 'running', 'paused', 'finished'

    play: () => {
      if (animation.playState === "idle") {
        start();
        return;
      }
      if (animation.playState === "running") {
        console.warn("animation already running");
        return;
      }
      if (animation.playState === "paused") {
        animation.playState = "running";
        resume();
        return;
      }
      // "finished"
      start();
    },

    progress: (progress) => {
      if (animation.playState === "idle") {
        console.warn("Cannot progress animation that is idle");
        return;
      }
      if (animation.playState === "finished") {
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
      if (animation.playState === "paused") {
        console.warn("animation already paused");
        return;
      }
      if (animation.playState === "finished") {
        console.warn("Cannot pause a finished animation");
        return;
      }
      animation.playState = "paused";
      const pauseTime = document.timeline.currentTime;
      removeFromTimeline(animation);
      resume = () => {
        const pausedDuration = document.timeline.currentTime - pauseTime;
        animation.startTime += pausedDuration;
        addOnTimeline(animation);
      };
    },

    cancel: () => {
      if (transition) {
        removeFromTimeline(animation);
        teardown();
        restore();
      }
      resume = null;
      animation.playState = "idle";
    },

    finish: () => {
      if (animation.playState === "idle") {
        console.warn("Cannot finish an animation that is idle");
        return;
      }
      if (animation.playState === "finished") {
        console.warn("animation already finished");
        return;
      }
      // "running" or "paused"
      removeFromTimeline(animation);
      teardown();
      resume = null;
      animation.playState = "finished";
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
      if (animation.playState === "idle") {
        console.warn("Cannot update target of idle animation");
        return;
      }
      if (animation.playState === "finished") {
        console.warn("Cannot update target of finished animation");
        return;
      }
      const currentValue = transition.value;
      transition.from = currentValue;
      transition.to = newTarget;
      resetStartTime();
    },
  };

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
