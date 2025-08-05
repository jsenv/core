import { createPlaybackGroup } from "./animation_playback.js";

/**
 * Creates a multi-animation controller that manages ongoing animations
 * and handles target updates automatically
 */
export const createMultiAnimationController = () => {
  // Track ongoing animations by targetKey + constructor combination
  const ongoingAnimations = new Map();
  // Also maintain a Set for cancellation purposes
  const activeAnimations = new Set();

  return {
    /**
     * Animate multiple animations simultaneously
     * Automatically handles updateTarget for elements that are already animating
     * @param {Array} animations - Array of animation objects with updateTarget capability
     * @param {Object} options - Animation options
     * @param {Function} options.onChange - Called with (changeEntries, isLast) during animation
     * @param {Function} options.onFinish - Called when all animations complete
     * @returns {Object} Playback controller with play(), pause(), cancel(), etc.
     */
    animate: (animations, options = {}) => {
      const { onChange, onFinish } = options;

      if (animations.length === 0) {
        return {
          play: () => {},
          pause: () => {},
          cancel: () => {},
          finish: () => {},
          playState: "idle",
          channels: { progress: { add: () => {} }, finish: { add: () => {} } },
        };
      }

      const newAnimations = [];
      const updatedAnimations = [];

      // Separate animations into new vs updates to existing ones
      for (const animation of animations) {
        // Create a key to identify this type of animation on this target
        const animationKey = `${animation.constructor?.name || "unknown"}_${animation.targetKey ? animation.targetKey.toString() : "notarget"}`;
        const existingAnimation = ongoingAnimations.get(animationKey);

        if (existingAnimation && existingAnimation.playState === "running") {
          // Update the existing animation's target if it supports updateTarget
          if (
            existingAnimation.updateTarget &&
            animation.targetValue !== undefined
          ) {
            existingAnimation.updateTarget(animation.targetValue);
          }
          updatedAnimations.push(existingAnimation);
        } else {
          // Track this animation by its key
          ongoingAnimations.set(animationKey, animation);
          activeAnimations.add(animation);
          // Clean up tracking when animation finishes
          animation.channels.finish.add(() => {
            ongoingAnimations.delete(animationKey);
            activeAnimations.delete(animation);
          });

          newAnimations.push(animation);
        }
      }

      // If we only have updated animations (no new ones), return a minimal controller
      if (newAnimations.length === 0) {
        return {
          play: () => {}, // Already playing
          pause: () =>
            updatedAnimations.forEach((animation) => animation.pause()),
          cancel: () =>
            updatedAnimations.forEach((animation) => animation.cancel()),
          finish: () =>
            updatedAnimations.forEach((animation) => animation.finish()),
          playState: "running", // All are already running
          channels: {
            progress: { add: () => {} }, // Progress tracking already set up
            finish: { add: () => {} },
          },
        };
      }

      // Create group controller to coordinate new animations only
      const groupController = createPlaybackGroup(newAnimations);

      // Add unified progress tracking for ALL animations (new + updated)
      if (onChange) {
        groupController.channels.progress.add((transition) => {
          // Build change entries for current state of ALL animations
          const changeEntries = [...newAnimations, ...updatedAnimations].map(
            (animation) => ({
              animation,
              value: animation.content.value,
            }),
          );

          onChange(changeEntries, transition.progress === 1); // isLast = progress === 1
        });
      }

      // Add finish tracking
      if (onFinish) {
        groupController.channels.finish.add(() => {
          const changeEntries = [...newAnimations, ...updatedAnimations].map(
            (animation) => ({
              animation,
              value: animation.content.value,
            }),
          );
          onFinish(changeEntries);
        });
      }

      return groupController;
    },

    /**
     * Cancel all ongoing animations managed by this controller
     */
    cancel: () => {
      // Cancel all active animations
      for (const animation of activeAnimations) {
        if (
          animation.playState === "running" ||
          animation.playState === "paused"
        ) {
          animation.cancel();
        }
      }
      // Clear the sets - the finish callbacks will handle individual cleanup
      activeAnimations.clear();
    },
  };
};
