import { createTransition } from "./transition_playback.js";

// Group transition that manages multiple transitions
export const createTransitionGroup = (transitionArray) => {
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

/**
 * Creates a transition group controller that manages ongoing transitions
 * and handles target updates automatically
 */
export const createTransitionGroupController = () => {
  // Track all active transitions for cancellation and matching
  const activeTransitions = new Set();

  return {
    /**
     * Animate multiple transitions simultaneously
     * Automatically handles updateTarget for transitions that match constructor + targetKey
     * @param {Array} transitions - Array of transition objects with constructor and targetKey properties
     * @param {Object} options - Transition options
     * @param {Function} options.onChange - Called with (changeEntries, isLast) during transition
     * @param {Function} options.onFinish - Called when all transitions complete
     * @returns {Object} Playback controller with play(), pause(), cancel(), etc.
     */
    animate: (transitions, options = {}) => {
      const { onChange, onFinish } = options;

      if (transitions.length === 0) {
        return {
          play: () => {},
          pause: () => {},
          cancel: () => {},
          finish: () => {},
          playState: "idle",
          channels: { progress: { add: () => {} }, finish: { add: () => {} } },
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
          playState: "running", // All are already running
          channels: {
            progress: { add: () => {} }, // Progress tracking already set up
            finish: { add: () => {} },
          },
        };
      }

      // Create group controller to coordinate new transitions only
      const groupController = createTransitionGroup(newTransitions);

      // Add unified progress tracking for ALL transitions (new + updated)
      if (onChange) {
        groupController.channels.progress.add((transition) => {
          // Build change entries for current state of ALL transitions
          const changeEntries = [...newTransitions, ...updatedTransitions].map(
            (transition) => ({
              transition,
              value: transition.value,
            }),
          );

          onChange(changeEntries, transition.progress === 1); // isLast = progress === 1
        });
      }

      // Add finish tracking
      if (onFinish) {
        groupController.channels.finish.add(() => {
          const changeEntries = [...newTransitions, ...updatedTransitions].map(
            (transition) => ({
              transition,
              value: transition.value,
            }),
          );
          onFinish(changeEntries);
        });
      }

      return groupController;
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
