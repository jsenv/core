/**
 * Determines if the current color scheme is dark mode
 * @param {Element} [element] - DOM element to check color-scheme against (optional)
 * @returns {boolean} True if dark mode is active
 */
export const prefersDarkColors = (element) => {
  const colorScheme = getPreferedColorScheme(element);
  return colorScheme.includes("dark");
};
export const prefersLightColors = (element) => {
  return !prefersDarkColors(element);
};
export const getPreferedColorScheme = (element) => {
  const computedStyle = getComputedStyle(element || document.documentElement);
  const colorScheme = computedStyle.colorScheme;

  // If no explicit color-scheme is set, or it's "normal",
  // fall back to prefers-color-scheme media query
  if (!colorScheme || colorScheme === "normal") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  return colorScheme;
};
