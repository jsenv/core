export const maintainSizeOnContentChange = (element) => {
  // Store current height to detect changes
  let currentHeight = element.offsetHeight;
  // Flag to prevent transition during the initial content rendering
  let isFirstMutation = true;

  // Create mutation observer to detect content changes
  const mutationObserver = new MutationObserver(() => {
    if (isFirstMutation) {
      isFirstMutation = false;
      return;
    }
    prepareTransition();
  });

  // Create resize observer to detect size changes
  const resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;

    const newHeight = entry.contentRect.height;
    if (newHeight === currentHeight) return;

    // Update element style with the new height
    element.style.height = `${newHeight}px`;
    currentHeight = newHeight;
  });

  // Function to prepare element for height transition
  const prepareTransition = () => {
    // Set initial height explicitly to allow transition
    element.style.height = `${currentHeight}px`;
    // Force a reflow to ensure the initial height is applied
    element.offsetHeight; // eslint-disable-line no-unused-expressions
    // Add transition
    element.style.transition = `height 300ms ease-out`;
    // Remove transition after it completes
    const onTransitionEnd = () => {
      element.style.transition = "";
      element.removeEventListener("transitionend", onTransitionEnd);
    };
    element.addEventListener("transitionend", onTransitionEnd);
  };

  // Start observing
  mutationObserver.observe(element, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
  });
  resizeObserver.observe(element);

  // Return cleanup function
  return () => {
    mutationObserver.disconnect();
    resizeObserver.disconnect();
  };
};
