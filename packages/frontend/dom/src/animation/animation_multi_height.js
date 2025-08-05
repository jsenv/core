import { createHeightAnimation } from "./animation_dom.js";
import { createPlaybackGroup } from "./animation_playback.js";

/**
 * Creates a multi-animation controller that manages ongoing animations
 * and handles target updates automatically
 */
export const createMultiHeightAnimationController = () => {
  // Track ongoing animations by element within this controller instance
  const ongoingAnimations = new WeakMap();
  // Also maintain a Set for cancellation purposes
  const activeAnimations = new Set();

  return {
    /**
     * Animate multiple elements to different target heights simultaneously
     * Automatically handles updateTarget for elements that are already animating
     * @param {Array} animations - Array of {element, target, sideEffect?} objects
     * @param {Object} options - Animation options
     * @param {number} options.duration - Animation duration in ms
     * @param {Function} options.onChange - Called with (changeEntries, isLast) during animation
     * @param {Function} options.onFinish - Called when all animations complete
     * @returns {Object} Playback controller with play(), pause(), cancel(), etc.
     */
    animate: (animations, options = {}) => {
      const { duration = 300, onChange, onFinish } = options;

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

      // Separate elements into new animations vs updates to existing ones
      for (const { element, target, sideEffect } of animations) {
        const existingAnimation = ongoingAnimations.get(element);
        if (existingAnimation && existingAnimation.playState === "running") {
          // Update existing animation target
          existingAnimation.updateTarget(target);
          updatedAnimations.push({
            element,
            target,
            sideEffect,
            animation: existingAnimation,
          });
        } else {
          const animation = createHeightAnimation(element, target, {
            duration,
          });
          // Track this animation in this controller instance
          ongoingAnimations.set(element, animation);
          activeAnimations.add(animation);
          // Clean up tracking when animation finishes
          animation.channels.finish.add(() => {
            ongoingAnimations.delete(element);
            activeAnimations.delete(animation);
          });
          // Add side effects to progress tracking
          if (sideEffect) {
            animation.channels.progress.add((transition) => {
              const { value, timing } = transition;
              sideEffect(value, { timing });
            });
          }

          newAnimations.push({
            element,
            target,
            sideEffect,
            animation,
          });
        }
      }

      // If we only have updated animations (no new ones), return a minimal controller
      if (newAnimations.length === 0) {
        return {
          play: () => {}, // Already playing
          pause: () =>
            updatedAnimations.forEach(({ animation }) => animation.pause()),
          cancel: () =>
            updatedAnimations.forEach(({ animation }) => animation.cancel()),
          finish: () =>
            updatedAnimations.forEach(({ animation }) => animation.finish()),
          playState: "running", // All are already running
          channels: {
            progress: { add: () => {} }, // Progress tracking already set up
            finish: { add: () => {} },
          },
        };
      }

      // Create group controller to coordinate new animations only
      const groupController = createPlaybackGroup(
        newAnimations.map(({ animation }) => animation),
      );

      // Add unified progress tracking for ALL animations (new + updated)
      if (onChange) {
        groupController.channels.progress.add((transition) => {
          // Build change entries for current state of ALL elements
          const changeEntries = [...newAnimations, ...updatedAnimations].map(
            ({ element, animation }) => ({
              element,
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
            ({ element, target }) => ({
              element,
              value: target,
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
