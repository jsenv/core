export const maintainSizeOnContentChange = (element) => {
  let currentHeight = null;

  const updateElementHeight = (newHeight) => {
    if (currentHeight === null) {
      // Initial setup - set height without transition
      element.style.height = `${newHeight}px`;
      currentHeight = newHeight;
      return;
    }

    if (newHeight === currentHeight) {
      return;
    }

    // Set current height explicitly to start transition from
    element.style.height = `${currentHeight}px`;
    // Force a reflow
    element.offsetHeight; // eslint-disable-line no-unused-expressions
    // Add transition and update to new height
    element.style.transition = `height 300ms ease-out`;
    element.style.height = `${newHeight}px`;

    // Cleanup transition after it completes
    const onTransitionEnd = () => {
      element.style.transition = "";
      element.removeEventListener("transitionend", onTransitionEnd);
    };
    element.addEventListener("transitionend", onTransitionEnd, { once: true });

    currentHeight = newHeight;
  };

  // Set initial height
  updateElementHeight(element.offsetHeight);

  // Watch for DOM mutations that might affect height
  const mutationObserver = new MutationObserver(() => {
    // Use scrollHeight to get the full height including overflow
    updateElementHeight(element.scrollHeight);
  });

  // Watch for direct size changes
  const resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;
    updateElementHeight(entry.contentRect.height);
  });

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
    element.style.height = "";
    element.style.transition = "";
  };
};
