// Helper to create scroll state capture/restore function for an element
export const captureScrollState = (element) => {
  const scrollLeft = element.scrollLeft;
  const scrollTop = element.scrollTop;
  const scrollWidth = element.scrollWidth;
  const scrollHeight = element.scrollHeight;
  const clientWidth = element.clientWidth;
  const clientHeight = element.clientHeight;

  // Calculate scroll percentages to preserve relative position
  const scrollLeftPercent =
    scrollWidth > clientWidth ? scrollLeft / (scrollWidth - clientWidth) : 0;
  const scrollTopPercent =
    scrollHeight > clientHeight ? scrollTop / (scrollHeight - clientHeight) : 0;

  // Return preserve function that maintains scroll position relative to content
  return () => {
    // Get current dimensions after DOM changes
    const newScrollWidth = element.scrollWidth;
    const newScrollHeight = element.scrollHeight;
    const newClientWidth = element.clientWidth;
    const newClientHeight = element.clientHeight;

    // If content dimensions changed significantly, use percentage-based positioning
    if (
      Math.abs(newScrollWidth - scrollWidth) > 1 ||
      Math.abs(newScrollHeight - scrollHeight) > 1 ||
      Math.abs(newClientWidth - clientWidth) > 1 ||
      Math.abs(newClientHeight - clientHeight) > 1
    ) {
      if (newScrollWidth > newClientWidth) {
        const newScrollLeft =
          scrollLeftPercent * (newScrollWidth - newClientWidth);
        element.scrollLeft = newScrollLeft;
      }

      if (newScrollHeight > newClientHeight) {
        const newScrollTop =
          scrollTopPercent * (newScrollHeight - newClientHeight);
        element.scrollTop = newScrollTop;
      }
    } else {
      element.scrollLeft = scrollLeft;
      element.scrollTop = scrollTop;
    }
  };
};
