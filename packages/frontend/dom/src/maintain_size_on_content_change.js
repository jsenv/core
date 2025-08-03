import { getInnerHeight } from "./size/get_inner_height.js";
import { getInnerWidth } from "./size/get_inner_width.js";
import { createSizeAnimationController } from "./size/size_animation_controller.js";

export const maintainSizeOnContentChange = (
  element,
  { duration = 300 } = {},
) => {
  const sizeController = createSizeAnimationController(element, { duration });

  // Measure natural content size
  let currentWidth = getInnerWidth(element);
  let currentHeight = getInnerHeight(element);

  // Set initial size without animation
  element.style.width = `${currentWidth}px`;
  element.style.height = `${currentHeight}px`;

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

      // Get unconstrained content size
      const naturalWidth = getInnerWidth(element);
      const naturalHeight = getInnerHeight(element);

      // Restore size constraints
      element.style.width = `${currentWidth}px`;
      element.style.height = `${currentHeight}px`;

      // Only animate if size actually changed
      if (naturalWidth !== currentWidth || naturalHeight !== currentHeight) {
        currentWidth = naturalWidth;
        currentHeight = naturalHeight;
        sizeController.animateTo({
          width: naturalWidth,
          height: naturalHeight,
        });
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
