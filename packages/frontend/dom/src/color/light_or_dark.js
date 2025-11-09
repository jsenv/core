/**
 * Chooses between light and dark colors based on which provides better contrast against a background
 * @param {string} backgroundColor - CSS color value (hex, rgb, hsl, CSS variable, etc.) to test against
 * @param {string} [lightColor="white"] - Light color option (typically for dark backgrounds)
 * @param {string} [darkColor="black"] - Dark color option (typically for light backgrounds)
 * @param {Element} [element] - DOM element to resolve CSS variables against
 * @returns {string} The color that provides better contrast (lightColor or darkColor)
 * @example
 * // Choose text color for a dark blue background
 * pickLightOrDark("#1a202c") // returns "white"
 *
 * // Choose text color for a light background with CSS variable
 * pickLightOrDark("var(--bg-color)", "white", "black", element) // returns "black" or "white"
 */
import { getContrastRatio, getLuminance } from "./color_constrast.js";
import { resolveCSSColor } from "./resolve_css_color.js";

export const pickLightOrDark = (
  backgroundColor,
  lightColor = "white",
  darkColor = "black",
  element,
) => {
  const resolvedBgColor = resolveCSSColor(backgroundColor, element);
  const resolvedLightColor = resolveCSSColor(lightColor, element);
  const resolvedDarkColor = resolveCSSColor(darkColor, element);

  if (!resolvedBgColor || !resolvedLightColor || !resolvedDarkColor) {
    // Fallback to light color if parsing fails
    return lightColor;
  }

  const contrastWithLight = getContrastRatio(
    resolvedBgColor,
    resolvedLightColor,
  );
  const contrastWithDark = getContrastRatio(resolvedBgColor, resolvedDarkColor);

  return contrastWithLight > contrastWithDark ? lightColor : darkColor;
};

/**
 * Resolves the luminance value of a CSS color
 * @param {string} color - CSS color value (hex, rgb, hsl, CSS variable, etc.)
 * @param {Element} [element] - DOM element to resolve CSS variables against
 * @returns {number|undefined} Relative luminance (0-1) according to WCAG formula, or undefined if color cannot be resolved
 * @example
 * // Get luminance of a hex color
 * resolveColorLuminance("#ff0000") // returns ~0.213 (red)
 *
 * // Get luminance of a CSS variable
 * resolveColorLuminance("var(--primary-color)", element) // returns luminance value or undefined
 *
 * // Use for light/dark classification
 * const luminance = resolveColorLuminance("#2ecc71");
 * const isLight = luminance > 0.3; // true for light colors, false for dark
 */
export const resolveColorLuminance = (color, element) => {
  const resolvedColor = resolveCSSColor(color, element);
  if (!resolvedColor) {
    return undefined;
  }
  const [r, g, b] = resolvedColor;
  return getLuminance(r, g, b);
};
