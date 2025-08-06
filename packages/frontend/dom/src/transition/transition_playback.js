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

export const createTransition = ({
  constructor,
  key,
  from,
  to,
  lifecycle = LIFECYCLE_DEFAULT,
  onProgress,
  ...rest
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
    startTime: null,
    progress: 0,
    timing: "",
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

    update: ({ value, progress }) => {
      if (playState === "idle") {
        console.warn("Cannot progress transition that is idle");
        return;
      }
      if (playState === "finished") {
        console.warn("Cannot progress a finished transition");
        return;
      }

      transition.value = value;
      transition.progress = progress;
      transition.timing =
        progress === 1 ? "end" : isFirstUpdate ? "start" : "progress";
      isFirstUpdate = false;
      executionLifecycle.update(transition);
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

    ...rest,
  };

  return transition;
};

// Timeline-managed transition that adds/removes itself from the animation timeline
export const createTimelineTransition = ({
  isVisual,
  duration,
  fps = 60,
  easing = EASING.EASE_OUT,
  lifecycle,
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
    const msElapsedSinceStart = timelineCurrentTime - transition.startTime;
    const msRemaining = transition.duration - msElapsedSinceStart;
    let progress = 0;
    let value;

    if (
      // we reach the end, round progress to 1
      msRemaining < 0 ||
      // we are very close from the end, round progress to 1
      msRemaining <= transition.frameDuration
    ) {
      progress = 1;
      value = transition.to;
      transition.frameRemainingCount = 0;
    } else {
      if (lastUpdateTime === -1) {
        // First frame - always allow
      } else {
        const timeSinceLastUpdate = timelineCurrentTime - lastUpdateTime;
        // Skip update if not enough time has passed for the target FPS
        if (timeSinceLastUpdate < transition.frameDuration) {
          return;
        }
      }
      lastUpdateTime = timelineCurrentTime;
      progress = Math.min(msElapsedSinceStart / transition.duration, 1);
      const easedProgress = transition.easing(progress);
      value =
        transition.from + (transition.to - transition.from) * easedProgress;
      transition.frameRemainingCount = Math.ceil(
        msRemaining / transition.frameDuration,
      );
    }
    transition.update({ progress, value });
  };
  const onTimelineNeeded = () => {
    addOnTimeline(timeChangeCallback, isVisual);
  };
  const onTimelineNotNeeded = () => {
    removeFromTimeline(timeChangeCallback, isVisual);
  };

  const { setup } = lifecycle;
  const transition = createTransition({
    ...options,
    startTime: null,
    duration,
    easing,
    fps,
    get frameDuration() {
      return 1000 / fps;
    },
    frameRemainingCount: 0,
    lifecycle: {
      ...lifecycle,
      setup: (transition) => {
        // Handle timeline management
        lastUpdateTime = -1;
        transition.startTime = getTimelineCurrentTime();
        transition.frameRemainingCount = Math.ceil(
          transition.duration / transition.frameDuration,
        );
        onTimelineNeeded();
        // Call the original setup
        return setup(transition);
      },
      pause: (transition) => {
        const pauseTime = getTimelineCurrentTime();
        onTimelineNotNeeded();
        return () => {
          const pausedDuration = getTimelineCurrentTime() - pauseTime;
          transition.startTime += pausedDuration;
          // Only adjust lastUpdateTime if it was set (not -1)
          if (lastUpdateTime !== -1) {
            lastUpdateTime += pausedDuration;
          }
          onTimelineNeeded();
        };
      },
      updateTarget: (transition) => {
        transition.startTime = getTimelineCurrentTime();
        // Don't reset lastUpdateTime - we want visual continuity for smooth target updates
        transition.frameRemainingCount = Math.ceil(
          transition.duration / transition.frameDuration,
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
