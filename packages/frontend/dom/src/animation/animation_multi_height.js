import { createHeightAnimation } from "./animation_dom.js";
import { createPlaybackGroup } from "./animation_playback.js";

/**
 * Animate multiple elements to different target heights simultaneously
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

  // Create individual height animations for each element
  const playbackControllers = animations.map(
    ({ element, target, sideEffect }) => {
      const animation = createHeightAnimation(element, target, {
        duration,
        // Always use current height as explicit from value for precise control
        from: Math.round(
          parseFloat(element.style.height) || element.offsetHeight,
        ),
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

  // Create group controller to coordinate all animations
  const groupController = createPlaybackGroup(
    playbackControllers.map(({ animation }) => animation),
  );

  // Add unified progress tracking
  if (onChange) {
    groupController.channels.progress.add((progress) => {
      // Build change entries for current state
      const changeEntries = playbackControllers.map(({ element }) => ({
        element,
        value: Math.round(
          parseFloat(element.style.height) || element.offsetHeight,
        ),
      }));

      onChange(changeEntries, progress === 1); // isLast = progress === 1
    });
  }

  // Add finish tracking
  if (onFinish) {
    groupController.channels.finish.add(() => {
      const changeEntries = playbackControllers.map(({ element, target }) => ({
        element,
        value: target,
      }));
      onFinish(changeEntries);
    });
  }

  return {
    ...groupController,
    elements: playbackControllers.map(({ element }) => element),
    targets: playbackControllers.map(({ target }) => target),
  };
};
