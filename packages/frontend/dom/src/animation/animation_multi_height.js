import { createHeightAnimation } from "./animation_dom.js";
import { createPlaybackGroup } from "./animation_playback.js";

// Global tracking of ongoing animations by element
const ongoingAnimations = new WeakMap();

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
export const animateMultipleHeights = (animations, options = {}) => {
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
      // Create new animation
      newAnimations.push({ element, target, sideEffect });
    }
  }

  // Create individual height animations for new elements
  const playbackControllers = newAnimations.map(
    ({ element, target, sideEffect }) => {
      const animation = createHeightAnimation(element, target, {
        duration,
        // Always use current height as explicit from value for precise control
        from: Math.round(
          parseFloat(element.style.height) || element.offsetHeight,
        ),
      });

      // Track this animation globally
      ongoingAnimations.set(element, animation);

      // Clean up tracking when animation finishes
      animation.channels.finish.add(() => {
        ongoingAnimations.delete(element);
      });

      // Add side effects to progress tracking
      if (sideEffect) {
        animation.channels.progress.add((progress) => {
          const currentHeight = Math.round(
            parseFloat(element.style.height) || element.offsetHeight,
          );
          sideEffect(currentHeight, {
            timing:
              progress === 0 ? "start" : progress === 1 ? "end" : "progress",
          });
        });
      }

      return { animation, element, target, sideEffect };
    },
  );

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
    playbackControllers.map(({ animation }) => animation),
  );

  // Add unified progress tracking for ALL animations (new + updated)
  if (onChange) {
    groupController.channels.progress.add((progress) => {
      // Build change entries for current state of ALL elements
      const changeEntries = [...newAnimations, ...updatedAnimations].map(
        ({ element }) => ({
          element,
          value: Math.round(
            parseFloat(element.style.height) || element.offsetHeight,
          ),
        }),
      );

      onChange(changeEntries, progress === 1); // isLast = progress === 1
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

  return {
    ...groupController,
    elements: [...newAnimations, ...updatedAnimations].map(
      ({ element }) => element,
    ),
    targets: [...newAnimations, ...updatedAnimations].map(
      ({ target }) => target,
    ),
  };
};
