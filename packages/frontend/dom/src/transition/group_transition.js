import { createPubSub } from "../pub_sub.js";
import { createTransition } from "./transition_playback.js";

/**
 * Creates an interface that manages ongoing transitions
 * and handles target updates automatically
 */
export const createGroupTransitionController = (groupTransitionOptions) => {
  // Track all active transitions for cancellation and matching
  const activeTransitions = new Set();

  return {
    /**
     * Control multiple transitions simultaneously
     * Automatically handles updateTarget for transitions that match constructor + targetKey
     * @param {Array} transitions - Array of transition objects with constructor and targetKey properties
     * @param {Object} options - Transition options
     * @param {Function} options.onChange - Called with (changeEntries, isLast) during transition
     * @param {Function} options.onFinish - Called when all transitions complete
     * @param {Function} options.onCancel - Called when transitions are cancelled
     * @returns {Object} Playback controller with play(), pause(), cancel(), etc.
     */
    update: (transitions, options = {}) => {
      const { onChange, onCancel, onFinish } = options;

      if (transitions.length === 0) {
        // No transitions to animate, call onFinish immediately
        if (onFinish) {
          onFinish([]);
        }
        return {
          play: () => {},
          pause: () => {},
          cancel: () => {},
          finish: () => {},
          playState: "idle",
          channels: {
            update: { add: () => {} },
            cancel: { add: () => {} },
            finish: { add: () => {} },
          },
        };
      }

      const newTransitions = [];
      const updatedTransitions = [];

      // Separate transitions into new vs updates to existing ones
      for (const transition of transitions) {
        // Look for existing transition with same constructor and targetKey
        let existingTransition = null;
        for (const transitionCandidate of activeTransitions) {
          if (
            transitionCandidate.constructor === transition.constructor &&
            transitionCandidate.key === transition.key
          ) {
            existingTransition = transitionCandidate;
            break;
          }
        }

        if (existingTransition && existingTransition.playState === "running") {
          // Update the existing transition's target if it supports updateTarget
          if (existingTransition.updateTarget) {
            existingTransition.updateTarget(transition.to);
          }
          updatedTransitions.push(existingTransition);
        } else {
          // Track this new transition
          activeTransitions.add(transition);
          // Clean up tracking when transition finishes
          transition.channels.finish.add(() => {
            activeTransitions.delete(transition);
          });

          newTransitions.push(transition);
        }
      }

      // If we only have updated transitions (no new ones), return a minimal controller
      if (newTransitions.length === 0) {
        return {
          play: () => {}, // Already playing
          pause: () =>
            updatedTransitions.forEach((transition) => transition.pause()),
          cancel: () =>
            updatedTransitions.forEach((transition) => transition.cancel()),
          finish: () =>
            updatedTransitions.forEach((transition) => transition.finish()),
          reverse: () =>
            updatedTransitions.forEach((transition) => transition.reverse()),
          playState: "running", // All are already running
          channels: {
            update: { add: () => {} }, // Update tracking already set up
            cancel: { add: () => {} },
            finish: { add: () => {} },
          },
        };
      }

      // Create group transition to coordinate new transitions only
      const groupTransition = createGroupTransition(
        newTransitions,
        groupTransitionOptions,
      );

      // Add unified update tracking for ALL transitions (new + updated)
      if (onChange) {
        groupTransition.channels.update.add((transition) => {
          // Build change entries for current state of ALL transitions
          const changeEntries = [...newTransitions, ...updatedTransitions].map(
            (transition) => ({
              transition,
              value: transition.value,
            }),
          );

          const isLast = transition.value >= 1; // isLast = value >= 1 (since group tracks 0-1)
          onChange(changeEntries, isLast);
        });
      }

      if (onCancel) {
        groupTransition.channels.cancel.add(() => {
          const changeEntries = [...newTransitions, ...updatedTransitions].map(
            (transition) => ({
              transition,
              value: transition.value,
            }),
          );
          onCancel(changeEntries);
        });
      }

      // Add finish tracking
      if (onFinish) {
        groupTransition.channels.finish.add(() => {
          const changeEntries = [...newTransitions, ...updatedTransitions].map(
            (transition) => ({
              transition,
              value: transition.value,
            }),
          );
          onFinish(changeEntries);
        });
      }

      return groupTransition;
    },

    /**
     * Cancel all ongoing transitions managed by this controller
     */
    cancel: () => {
      // Cancel all active transitions
      for (const transition of activeTransitions) {
        if (
          transition.playState === "running" ||
          transition.playState === "paused"
        ) {
          transition.cancel();
        }
      }
      // Clear the sets - the finish callbacks will handle individual cleanup
      activeTransitions.clear();
    },
  };
};

// transition that manages multiple transitions
const createGroupTransition = (transitionArray, options = {}) => {
  let childCount = transitionArray.length;
  // duration is infered from the longest child transition
  let duration = 0;
  for (const childTransition of transitionArray) {
    if (childTransition.duration > duration) {
      duration = childTransition.duration;
    }
  }

  const groupTransition = createTransition({
    ...options,
    constructor: createGroupTransition,
    from: 0,
    to: 1,
    duration,
    baseLifecycle: {
      setup: (transition) => {
        let finishedCount = 0;

        const [cleanup, addCleanup] = createPubSub();

        for (const childTransition of transitionArray) {
          const removeFinishListener = childTransition.channels.finish.add(
            // eslint-disable-next-line no-loop-func
            () => {
              finishedCount++;
              const allFinished = finishedCount === childCount;
              if (allFinished) {
                transition.finish();
              }
            },
          );
          addCleanup(removeFinishListener);
          childTransition.play();

          const removeUpdateListener = childTransition.channels.update.add(
            () => {
              // Calculate average progress (handle undefined progress)
              let totalProgress = 0;
              let progressCount = 0;
              for (const t of transitionArray) {
                if (typeof t.progress === "number") {
                  totalProgress += t.progress;
                  progressCount++;
                }
              }
              const averageProgress =
                progressCount > 0 ? totalProgress / progressCount : 0;
              transition.update(averageProgress);
            },
          );
          addCleanup(removeUpdateListener);
        }

        return {
          teardown: cleanup,
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
          if (childTransition.playState === "idle") {
            // child transition got canceled, keep it canceled
            continue;
          }
          if (childTransition.playState !== "finished") {
            childTransition.finish();
          }
        }
      },
      reverse: () => {
        for (const childTransition of transitionArray) {
          if (
            childTransition.playState === "running" ||
            childTransition.playState === "paused"
          ) {
            childTransition.reverse();
          }
        }
      },
    },
  });
  return groupTransition;
};
