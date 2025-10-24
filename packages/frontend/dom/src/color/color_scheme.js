/**
 * Determines if the current color scheme is dark mode
 * @param {Element} [element] - DOM element to check color-scheme against (optional)
 * @returns {boolean} True if dark mode is active
 */
export const colorSchemeIsDark = (element) => {
  if (element) {
    // Check the computed color-scheme property
    const computedStyle = getComputedStyle(element);
    const colorScheme = computedStyle.colorScheme;

    if (colorScheme.includes("dark")) {
      return true;
    }
    if (colorScheme.includes("light")) {
      return false;
    }
    // If color-scheme is not set or is 'normal', fall through to media query
  }

  // Fallback to system preference via media query
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
};
