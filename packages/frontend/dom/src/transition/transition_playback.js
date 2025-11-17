import { createIterableWeakSet } from "../iterable_weak_set.js";
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

const transitionPausedByBreakpointWeakSet = createIterableWeakSet();
const onTransitionPausedByBreakpoint = (transition) => {
  transitionPausedByBreakpointWeakSet.add(transition);
  transition.channels.finish.add(cleanupTransitionPausedByBreakpoint);
  transition.channels.cancel.add(cleanupTransitionPausedByBreakpoint);
};
const cleanupTransitionPausedByBreakpoint = (transition) => {
  transitionPausedByBreakpointWeakSet.delete(transition);
};
window.resumeTransitions = () => {
  for (const transition of transitionPausedByBreakpointWeakSet) {
    transition.play();
  }
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
      const resultA = lifecycleA.setup?.(transition) || {};
      const resultB = lifecycleB.setup?.(transition) || {};
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
    pause: (transition) => {
      const resumeA = lifecycleA.pause?.(transition);
      const resumeB = lifecycleB.pause?.(transition);
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

/**
 * Lifecycle object for managing transition behavior and DOM updates.
 *
 * The lifecycle pattern provides hooks for different transition phases:
 *
 * @typedef {Object} TransitionLifecycle
 * @property {Function} [setup] - Called when transition starts. Should return an object with:
 *   @property {number}   [from] - Override the transition's from value if transition.from is undefined
 *   @property {Function} [update] - Called on each frame with (transition) - handles DOM updates
 *   @property {Function} [restore] - Called when transition is cancelled - should reset DOM to original state
 *   @property {Function} [teardown] - Called when transition finishes or is cancelled - cleanup resources
 * @property {Function} [pause] - Called when transition is paused. Should return a resume function
 * @property {Function} [cancel] - Called when transition is cancelled
 * @property {Function} [finish] - Called when transition finishes naturally
 * @property {Function} [reverse] - Called when transition direction is reversed
 * @property {Function} [updateTarget] - Called when transition target is updated mid-flight
 *
 * @example
 * // Basic DOM animation lifecycle
 * const lifecycle = {
 *   setup: (transition) => {
 *     const element = document.getElementById('myElement');
 *     const originalWidth = element.style.width;
 *
 *     return {
 *       from: element.offsetWidth, // Override from value with current DOM state
 *       update: (transition) => {
 *         // Apply transition value to DOM on each frame
 *         element.style.width = `${transition.value}px`;
 *       },
 *       restore: () => {
 *         // Reset DOM when cancelled
 *         element.style.width = originalWidth;
 *       },
 *       teardown: () => {
 *         // Cleanup when done (remove temp styles, event listeners, etc.)
 *         element.style.width = '';
 *       }
 *     };
 *   },
 *   pause: (transition) => {
 *     // Handle pause logic if needed
 *     return () => {
 *       // Resume logic
 *     };
 *   }
 * };
 */
export const createTransition = ({
  constructor,
  key,
  from,
  to,
  easing = EASING.EASE_OUT,
  startProgress = 0, // Progress to start from (0-1)
  baseLifecycle,
  onUpdate,
  onFinish,
  minDiff,
  debugQuarterBreakpoints = false, // Shorthand for debugBreakpoints: [0.25, 0.75]
  debugBreakpoints = debugQuarterBreakpoints ? [0.25, 0.75] : [], // Array of progress values (0-1) where debugger should trigger
  pauseBreakpoints = [],
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

  const lifecycle = combineTwoLifecycle(baseLifecycle, rest.lifecycle);
  let breakpointMap;

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
    transition.update(transition.startProgress);
  };

  const transition = {
    constructor,
    key,
    from,
    to,
    progress: startProgress,
    startProgress,
    easedProgress: easing ? easing(startProgress) : startProgress,
    easing,
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
        transition.progress = transition.startProgress;
        breakpointMap = new Map();
        for (const debugBreakpoint of debugBreakpoints) {
          breakpointMap.set(debugBreakpoint, "debug");
        }
        for (const pauseBreakpoint of pauseBreakpoints) {
          breakpointMap.set(pauseBreakpoint, "pause");
        }
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

    update: (inputProgress) => {
      if (playState === "idle") {
        console.warn("Cannot update transition that is idle");
        return;
      }
      if (playState === "finished") {
        console.warn("Cannot update a finished transition");
        return;
      }
      let progress;
      if (startProgress) {
        // Apply start progress offset - transition runs from startProgress to 1
        // Progress represents a ratio (0-1), so we can't just add ratios together
        // Instead, we need to map inputProgress to the remaining progress range (1 - startProgress)
        // This could also exceed 1 if we used simple addition, but that's just a symptom of the conceptual error
        // Example: startProgress=0.3, inputProgress=0.5 → 0.3 + 0.5*(1-0.3) = 0.65
        progress = startProgress + inputProgress * (1 - startProgress);
      } else {
        progress = inputProgress;
      }
      transition.progress = progress;

      const easedProgress = easing ? easing(progress) : progress;
      transition.easedProgress = easedProgress;

      const value = applyTransitionProgress(
        transition,
        transition.from,
        transition.to,
      );
      transition.value = value;

      transition.timing =
        progress === 1 ? "end" : isFirstUpdate ? "start" : "progress";
      isFirstUpdate = false;
      executionLifecycle.update?.(transition);
      executeUpdateCallbacks(transition);
      onUpdate?.(transition);

      for (const [breakpoint, effect] of breakpointMap) {
        if (progress >= breakpoint) {
          breakpointMap.delete(breakpoint);
          if (effect === "debug") {
            console.log(
              `Debug breakpoint hit at ${(breakpoint * 100).toFixed(1)}% progress`,
            );
            const notifyDebuggerEnd = notifyDebuggerStart();
            debugger;
            notifyDebuggerEnd();
          }
          if (effect === "pause") {
            transition.pause();
            onTransitionPausedByBreakpoint(transition);
          }
        }
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
      executeCancelCallbacks(transition);
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
      executeFinishCallbacks(transition);
      onFinish?.(transition);
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

export const applyTransitionProgress = (transition, from, to) => {
  const { easedProgress } = transition;
  return applyRatioToDiff(from, to, easedProgress);
};
const applyRatioToDiff = (from, to, ratio) => {
  if (ratio === 0) {
    return from;
  }
  if (ratio === 1) {
    return to;
  }
  return from + (to - from) * ratio;
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
  ...options
}) => {
  if (typeof duration !== "number" || duration <= 0) {
    throw new Error(
      `Invalid duration: ${duration}. Duration must be a positive number.`,
    );
  }

  let lastUpdateTime = -1;
  const timeChangeCallback = () => {
    const timelineCurrentTime = getTimelineCurrentTime();

    detect_freeze: {
      const SUSPICIOUS_FRAME_DURATION_MS = 4000;
      // Detect frozen code (debugger, long pause) early
      // (not needed that much since introduce of debugBreakpoints option)
      const timeSinceLastUpdate =
        lastUpdateTime === -1
          ? timelineCurrentTime - transition.baseTime
          : timelineCurrentTime - lastUpdateTime;
      if (timeSinceLastUpdate > SUSPICIOUS_FRAME_DURATION_MS) {
        // Code was frozen for more than SUSPICIOUS_FRAME_DURATION (e.g. debugger)
        // Adjust baseTime to compensate for the freeze and update timing for next frame
        const freezeDuration = timeSinceLastUpdate - transition.frameDuration;
        transition.baseTime += freezeDuration;
        lastUpdateTime = timelineCurrentTime;
        return;
      }
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
      transition.update(1);
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
    transition.frameRemainingCount = Math.ceil(
      msRemaining / transition.frameDuration,
    );
    const progress = msElapsedSinceStart / transition.duration;
    transition.update(progress > 1 ? 1 : progress);
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
    duration,
    easing,
    fps,
    get frameDuration() {
      return 1000 / fps;
    },
    frameRemainingCount: 0,
    baseLifecycle: {
      setup: (transition) => {
        // Handle timeline management
        lastUpdateTime = -1;
        transition.baseTime = transition.startTime = getTimelineCurrentTime();
        // Calculate remaining frames based on remaining progress
        const remainingProgress = 1 - transition.progress;
        const remainingDuration = transition.duration * remainingProgress;
        transition.frameRemainingCount = Math.ceil(
          remainingDuration / transition.frameDuration,
        );
        onTimelineNeeded();
        const unsubscribeDebugger = subscribeDebugger(() => {
          transition.pause();
          return () => {
            // if we play() right after debugger
            // document.timeline.currentTime is still the same
            // and we can't adjust to the time ellapsed in the debugger session
            // we need to wait for the next js loop to have an updated
            // document.timeline.currentTime that takes into account the time spent in the debugger
            requestAnimationFrame(transition.play);
          };
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
