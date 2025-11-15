import { notifyDebuggerStart, subscribeDebugger } from "./debugger_topic.js";
import { EASING } from "./easing.js";
import {
  addOnTimeline,
  getTimelineCurrentTime,
  removeFromTimeline,
} from "./transition_timeline.js";

// Default lifecycle methods that do nothing
const LIFECYCLE_DEFAULT = {
  setup: () => {},
  pause: () => {},
  cancel: () => {},
  finish: () => {},
  updateTarget: () => {},
};

export const combineTwoLifecycle = (lifecycleA, lifecycleB) => {
  if (!lifecycleA && !lifecycleB) {
    return LIFECYCLE_DEFAULT;
  }
  if (!lifecycleB) {
    return lifecycleA;
  }
  if (!lifecycleA) {
    return lifecycleB;
  }

  return {
    setup: (transition) => {
      const resultA = lifecycleA.setup?.(transition);
      const resultB = lifecycleB.setup?.(transition);
      return {
        from: resultA.from ?? resultB.from,
        update: (transition) => {
          resultA.update?.(transition);
          resultB.update?.(transition);
        },
        restore: () => {
          resultA.restore?.();
          resultB.restore?.();
        },
        teardown: () => {
          resultA.teardown?.();
          resultB.teardown?.();
        },
      };
    },
    pause: () => {
      const resumeA = lifecycleA.pause?.();
      const resumeB = lifecycleB.pause?.();
      return () => {
        resumeA?.();
        resumeB?.();
      };
    },
    cancel: (transition) => {
      lifecycleA.cancel?.(transition);
      lifecycleB.cancel?.(transition);
    },
    finish: (transition) => {
      lifecycleA.finish?.(transition);
      lifecycleB.finish?.(transition);
    },
    updateTarget: (transition) => {
      lifecycleA.updateTarget?.(transition);
      lifecycleB.updateTarget?.(transition);
    },
  };
};

export const createTransition = ({
  constructor,
  key,
  from,
  to,
  baseLifecycle,
  onUpdate,
  minDiff,
  ...rest
} = {}) => {
  const [updateCallbacks, executeUpdateCallbacks] = createCallbackController();
  const [cancelCallbacks, executeCancelCallbacks] = createCallbackController();
  const [finishCallbacks, executeFinishCallbacks] = createCallbackController();
  const channels = {
    update: updateCallbacks,
    cancel: cancelCallbacks,
    finish: finishCallbacks,
  };
  if (onUpdate) {
    updateCallbacks.add(onUpdate);
  }

  const lifecycle = combineTwoLifecycle(baseLifecycle, rest.lifecycle);

  let playState = "idle"; // 'idle', 'running', 'paused', 'finished'
  let isFirstUpdate = false;
  let resume;
  let executionLifecycle = null;

  const start = () => {
    isFirstUpdate = true;
    playState = "running";

    executionLifecycle = lifecycle.setup?.(transition) || {};

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
        `${constructor.name} transition has identical from and to values (${transition.from}). This transition will have no effect.`,
      );
    } else if (typeof minDiff === "number" && diff < minDiff) {
      console.warn(
        `${constructor.name} transition difference is very small (${diff}). Consider if this transition is necessary (minimum threshold: ${minDiff}).`,
      );
    }
    transition.update(transition.value);
  };

  const transition = {
    constructor,
    key,
    from,
    to,
    value: from,
    timing: "",
    channels,
    get playState() {
      return playState;
    },

    play: () => {
      if (playState === "idle") {
        transition.value = transition.from;
        transition.timing = "";
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

    update: (value, isLast) => {
      if (playState === "idle") {
        console.warn("Cannot update transition that is idle");
        return;
      }
      if (playState === "finished") {
        console.warn("Cannot update a finished transition");
        return;
      }

      transition.value = value;
      transition.timing = isLast ? "end" : isFirstUpdate ? "start" : "progress";
      isFirstUpdate = false;
      executionLifecycle.update?.(transition);
      executeUpdateCallbacks(transition);
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
      resume = lifecycle.pause?.(transition);
    },

    cancel: () => {
      if (executionLifecycle) {
        lifecycle.cancel?.(transition);
        executionLifecycle.teardown?.();
        executionLifecycle.restore?.();
      }
      resume = null;
      playState = "idle";
      executeCancelCallbacks();
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
      lifecycle.finish?.(transition);
      executionLifecycle.teardown?.();
      resume = null;
      playState = "finished";
      executeFinishCallbacks();
    },

    reverse: () => {
      if (playState === "idle") {
        console.warn("Cannot reverse a transition that is idle");
        return;
      }
      if (playState === "finished") {
        console.warn("Cannot reverse a finished transition");
        return;
      }

      // Simply swap from and to values to reverse direction
      const originalFrom = transition.from;
      const originalTo = transition.to;

      transition.from = originalTo;
      transition.to = originalFrom;

      // Let the transition handle its own reverse logic (if any)
      lifecycle.reverse?.(transition);
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
      lifecycle.updateTarget?.(transition);
    },

    ...rest,
  };

  return transition;
};

/**
 * Creates a timeline-managed transition that automatically handles animation timing
 * and integrates with the global animation timeline.
 *
 * @param {Object} options - Configuration options for the transition
 * @param {boolean} [options.isVisual] - Whether this is a visual transition (affects timeline priority)
 * @param {number} options.duration - Duration of the transition in milliseconds
 * @param {number} [options.fps=60] - Target frames per second for the animation
 * @param {Function} [options.easing=EASING.EASE_OUT] - Easing function to apply to progress
 * @param {Object} [options.lifecycle] - Lifecycle methods for the transition
 * @param {number} [options.startProgress=0] - Progress value to start from (0-1)
 * @param {number[]} [options.debugBreakpoints=[]] - Array of progress values (0-1) where debugger should trigger
 * @param {boolean} [options.debugQuarterBreakpoints=false] - If true and debugBreakpoints is empty, sets breakpoints at 0.25 and 0.75
 * @param {*} [...options] - Additional options passed to createTransition
 * @returns {Object} Timeline transition object with play(), pause(), cancel(), finish() methods
 */
// Timeline-managed transition that adds/removes itself from the animation timeline
export const createTimelineTransition = ({
  isVisual,
  duration,
  fps = 60,
  easing = EASING.EASE_OUT,
  startProgress = 0, // Progress to start from (0-1)
  debugQuarterBreakpoints = false, // Shorthand for debugBreakpoints: [0.25, 0.75]
  debugBreakpoints = debugQuarterBreakpoints ? [0.25, 0.75] : [], // Array of progress values (0-1) where debugger should trigger
  ...options
}) => {
  if (typeof duration !== "number" || duration <= 0) {
    throw new Error(
      `Invalid duration: ${duration}. Duration must be a positive number.`,
    );
  }

  let lastUpdateTime = -1;
  const breakPointSet = new Set(debugBreakpoints);

  const timeChangeCallback = () => {
    const timelineCurrentTime = getTimelineCurrentTime();

    // Detect frozen code (debugger, long pause) early
    const timeSinceLastUpdate =
      lastUpdateTime === -1
        ? timelineCurrentTime - transition.baseTime
        : timelineCurrentTime - lastUpdateTime;

    if (timeSinceLastUpdate > 2000) {
      // Code was frozen for more than 2s (e.g. debugger)
      // Adjust baseTime to compensate for the freeze and update timing for next frame
      const freezeDuration = timeSinceLastUpdate - transition.frameDuration;
      transition.baseTime += freezeDuration;
      lastUpdateTime = timelineCurrentTime;
      return;
    }

    const msElapsedSinceStart = timelineCurrentTime - transition.baseTime;
    const msRemaining = transition.duration - msElapsedSinceStart;

    if (
      // we reach the end, round progress to 1
      msRemaining < 0 ||
      // we are very close from the end, round progress to 1
      msRemaining <= transition.frameDuration
    ) {
      transition.frameRemainingCount = 0;
      transition.progress = 1;
      transition.update(transition.to, true);
      transition.finish();
      return;
    }

    if (lastUpdateTime === -1) {
      // First frame - always allow
    } else {
      const timeSinceLastUpdate = timelineCurrentTime - lastUpdateTime;

      // Allow rendering if we're within 3ms of the target frame duration
      // This prevents choppy animations when browser timing is slightly off
      const frameTimeTolerance = 3; // ms
      const targetFrameTime = transition.frameDuration - frameTimeTolerance;

      // Skip update only if we're significantly early
      if (timeSinceLastUpdate < targetFrameTime) {
        return;
      }
    }
    lastUpdateTime = timelineCurrentTime;
    const rawProgress = Math.min(msElapsedSinceStart / transition.duration, 1);
    // Apply start progress offset - transition runs from startProgress to 1
    const progress = startProgress + rawProgress * (1 - startProgress);
    transition.progress = progress;

    // Check for debug breakpoints
    for (const breakpoint of breakPointSet) {
      if (progress >= breakpoint) {
        breakPointSet.delete(breakpoint);
        console.log(
          `Debug breakpoint hit at ${(breakpoint * 100).toFixed(1)}% progress`,
        );
        const notifyDebuggerEnd = notifyDebuggerStart();
        debugger;
        notifyDebuggerEnd();
      }
    }

    const easedProgress = transition.easing(progress);
    const value =
      transition.from + (transition.to - transition.from) * easedProgress;
    transition.frameRemainingCount = Math.ceil(
      msRemaining / transition.frameDuration,
    );
    transition.update(value);
  };
  const onTimelineNeeded = () => {
    addOnTimeline(timeChangeCallback, isVisual);
  };
  const onTimelineNotNeeded = () => {
    removeFromTimeline(timeChangeCallback, isVisual);
  };

  const transition = createTransition({
    ...options,
    startTime: null,
    baseTime: null,
    progress: startProgress, // Initialize with start progress
    duration,
    easing,
    fps,
    get frameDuration() {
      return 1000 / fps;
    },
    frameRemainingCount: 0,
    startProgress, // Store for calculations
    baseLifecycle: {
      setup: (transition) => {
        // Handle timeline management
        lastUpdateTime = -1;
        breakPointSet.clear(); // Reset breakpoints for new transition run
        transition.baseTime = transition.startTime = getTimelineCurrentTime();
        // Calculate remaining frames based on remaining progress
        const remainingProgress = 1 - startProgress;
        const remainingDuration = transition.duration * remainingProgress;
        transition.frameRemainingCount = Math.ceil(
          remainingDuration / transition.frameDuration,
        );
        onTimelineNeeded();
        const unsubscribeDebugger = subscribeDebugger(() => {
          return transition.pause();
        });
        return {
          teardown: () => {
            unsubscribeDebugger();
          },
        };
      },
      pause: (transition) => {
        const pauseTime = getTimelineCurrentTime();
        onTimelineNotNeeded();
        return () => {
          const pausedDuration = getTimelineCurrentTime() - pauseTime;
          transition.baseTime += pausedDuration;
          // Only adjust lastUpdateTime if it was set (not -1)
          if (lastUpdateTime !== -1) {
            lastUpdateTime += pausedDuration;
          }
          onTimelineNeeded();
        };
      },
      updateTarget: (transition) => {
        transition.baseTime = getTimelineCurrentTime();
        // Don't reset lastUpdateTime - we want visual continuity for smooth target updates
        // Recalculate remaining frames from current progress
        const remainingProgress = 1 - transition.progress;
        const remainingDuration = transition.duration * remainingProgress;
        transition.frameRemainingCount = Math.ceil(
          remainingDuration / transition.frameDuration,
        );
      },
      cancel: () => {
        onTimelineNotNeeded();
      },
      finish: () => {
        onTimelineNotNeeded();
      },
    },
  });
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
