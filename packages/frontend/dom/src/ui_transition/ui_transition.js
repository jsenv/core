/**
 * TODO:
 *
 * - rename data-ui-key="a_key"
 *
 * - when data-content-state is the same we animate size
 * - when data-content-state changes we cross fade content (with ability to animate differently than cross fade, like slide-left, slide-right etc)
 
 */

import { getInnerHeight } from "../size/get_inner_height.js";
import { getInnerWidth } from "../size/get_inner_width.js";
import { createSizeAnimationController } from "../size/size_animation_controller.js";

export const initUITransition = (element, { duration = 300 } = {}) => {
  const sizeController = createSizeAnimationController(element, { duration });

  // Track dimensions
  let lastContentWidth = 0; // Last known content state width
  let lastContentHeight = 0; // Last known content state height
  let currentWidth = 0; // Current width we're animating from
  let currentHeight = 0; // Current height we're animating from

  const measureSize = () => {
    return [getInnerWidth(element), getInnerHeight(element)];
  };
  [currentWidth, currentHeight] = measureSize();
  element.style.width = `${currentWidth}px`;
  element.style.height = `${currentHeight}px`;
  element.style.overflow = "hidden";

  let isUpdating = false;

  const updateSize = () => {
    if (isUpdating) {
      return; // Prevent recursive updates
    }

    try {
      isUpdating = true;

      // Temporarily remove size constraints to measure true content size
      element.style.width = "";
      element.style.height = "";
      sizeController.cancel(); // ensure any ongoing animations are stopped otherwise size measurements will be incorrect
      const [newWidth, newHeight] = measureSize();
      // Restore current size constraints
      element.style.width = `${currentWidth}px`;
      element.style.height = `${currentHeight}px`;

      if (newWidth === currentWidth && newHeight === currentHeight) {
        // no change in size
        return;
      }

      const preserveContentHeight = element.children[0]?.hasAttribute(
        "data-preserve-content-height",
      );

      if (preserveContentHeight) {
        // Non-content state: use last known content height
        // Width can change freely, but height is constrained to last content height
        const nextWidth = lastContentWidth || newWidth;
        const nextHeight = lastContentHeight || newHeight;

        // If we have content height and new state is taller, enable scrolling
        if (lastContentHeight && newHeight > lastContentHeight) {
          element.style.overflow = "auto";
        } else {
          element.style.overflow = "hidden";
        }

        sizeController.animateTo({
          width: nextWidth,
          height: nextHeight,
        });
        currentWidth = nextWidth;
        currentHeight = nextHeight;
      } else {
        lastContentWidth = newWidth;
        lastContentHeight = newHeight;
        // Content state: always hidden overflow
        element.style.overflow = "hidden";
        // Content state: update both current and content dimensions
        sizeController.animateTo({
          width: newWidth,
          height: newHeight,
        });
        currentWidth = newWidth;
        currentHeight = newHeight;
      }
    } finally {
      isUpdating = false;
    }
  };

  // Watch for DOM mutations that might affect size
  const mutationObserver = new MutationObserver(() => {
    updateSize();
  });

  // Start observing
  mutationObserver.observe(element, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  // Return cleanup function
  return () => {
    mutationObserver.disconnect();
    sizeController.cancel();
  };
};
