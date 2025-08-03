import { getInnerHeight } from "./size/get_inner_height.js";
import { getInnerWidth } from "./size/get_inner_width.js";
import { createSizeAnimationController } from "./size/size_animation_controller.js";

export const maintainSizeOnContentChange = (
  element,
  { duration = 300 } = {},
) => {
  const sizeController = createSizeAnimationController(element, { duration });

  // Track both current and content dimensions
  let lastContentWidth = 0;
  let lastContentHeight = 0;
  let currentWidth = 0;
  let currentHeight = 0;
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
      sizeController.cancel();
      const [newWidth, newHeight] = measureSize();
      // Restore size constraints
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
        currentWidth =
          lastContentWidth === undefined ? newWidth : lastContentWidth;
        currentHeight =
          lastContentHeight === undefined ? newHeight : lastContentHeight;
        sizeController.animateTo({
          width: newWidth,
          height: newHeight,
        });
        return;
      }
      // Content state: update both current and content heights
      currentWidth = newWidth;
      currentHeight = newHeight;
      lastContentWidth = newWidth;
      lastContentHeight = newHeight;
      sizeController.animateTo({
        width: newWidth,
        height: newHeight,
      });
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
