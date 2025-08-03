import { createSizeAnimationController } from "./size/size_animation_controller.js";

export const maintainSizeOnContentChange = (
  element,
  { duration = 300 } = {},
) => {
  const sizeController = createSizeAnimationController(element, { duration });

  // Keep track of the current computed size to prevent feedback loop
  let currentWidth = element.offsetWidth;
  let currentHeight = element.offsetHeight;

  // Set initial size without animation and constrain overflow
  element.style.width = `${currentWidth}px`;
  element.style.height = `${currentHeight}px`;
  element.style.overflow = "hidden";

  const updateSize = () => {
    // Temporarily remove size constraints to measure true content size
    element.style.width = "";
    element.style.height = "";
    // Get unconstrained content size
    const naturalWidth = element.scrollWidth;
    const naturalHeight = element.scrollHeight;
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
  };

  // Watch for DOM mutations that might affect size
  const mutationObserver = new MutationObserver(updateSize);

  // Watch for direct size changes (disabled for now as it might cause feedback loops)
  const resizeObserver = new ResizeObserver(() => {
    // We don't react to resize events as they might be caused by our own animations
    // updateSize();
  });

  // Start observing
  mutationObserver.observe(element, {
    childList: true,
    subtree: true,
    // characterData: true,
    // attributes: true,
  });
  resizeObserver.observe(element);

  // Return cleanup function
  return () => {
    mutationObserver.disconnect();
    resizeObserver.disconnect();
    sizeController.cancel();
  };
};
