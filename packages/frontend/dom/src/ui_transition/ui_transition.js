import { getInnerHeight } from "../size/get_inner_height.js";
import { getInnerWidth } from "../size/get_inner_width.js";
import { createSizeAnimationController } from "../size/size_animation_controller.js";

export const initUITransition = (element, { duration = 300 } = {}) => {
  const sizeController = createSizeAnimationController(element, { duration });

  // Track dimensions and UI state
  let lastContentWidth = 0; // Last known content state width
  let lastContentHeight = 0; // Last known content state height
  let currentWidth = 0; // Current width we're animating from
  let currentHeight = 0; // Current height we're animating from
  let lastUIKey = null; // Track the last UI key to detect content changes

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

      // Get current UI key and state information
      const firstChild = element.children[0];
      const currentUIKey = firstChild?.getAttribute("data-ui-key");
      const preserveContentHeight = firstChild?.hasAttribute(
        "data-preserve-content-height",
      );

      // Determine transition type based on UI key
      const isUIKeyChange = lastUIKey !== null && currentUIKey !== lastUIKey;

      // TODO: Handle cross-fade transitions
      // if (isUIKeyChange || (lastUIKey && preserveContentHeight)) {
      //   // 1. Clone current content
      //   // 2. Position it absolutely
      //   // 3. Add new content
      //   // 4. Fade between them
      //   // 5. Clean up after animation
      // }

      // Store current UI key for next update
      lastUIKey = currentUIKey;

      // Skip size animation if no changes
      if (newWidth === currentWidth && newHeight === currentHeight) {
        return;
      }

      // Handle height preservation and animation based on state
      if (isUIKeyChange) {
        // Different content: animate to new dimensions
        lastContentWidth = newWidth;
        lastContentHeight = newHeight;
        element.style.overflow = "hidden";
        sizeController.animateTo({
          width: newWidth,
          height: newHeight,
        });
        currentWidth = newWidth;
        currentHeight = newHeight;
      } else if (preserveContentHeight) {
        // Same content, preserve height from content state
        const nextWidth = lastContentWidth || newWidth;
        const nextHeight = lastContentHeight || newHeight;

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
        // Same content, content state: update dimensions
        lastContentWidth = newWidth;
        lastContentHeight = newHeight;
        element.style.overflow = "hidden";
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
