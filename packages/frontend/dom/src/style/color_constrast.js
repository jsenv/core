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

import { parseCSSColor } from "./parsing/css_color.js";

export const pickLightOrDark = (
  backgroundColor,
  lightColor = "white",
  darkColor = "black",
  element,
) => {
  const resolvedBgColor = parseCSSColor(backgroundColor, element);
  const resolvedLightColor = parseCSSColor(lightColor, element);
  const resolvedDarkColor = parseCSSColor(darkColor, element);

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
  const rgba = parseCSSColor(color, element);
  if (!rgba) {
    return undefined;
  }
  const [r, g, b] = rgba;
  return getLuminance(r, g, b);
};

/**
 * Calculates the contrast ratio between two RGBA colors
 * Based on WCAG 2.1 specification
 * @param {Array<number>} rgba1 - [r, g, b, a] values for first color
 * @param {Array<number>} rgba2 - [r, g, b, a] values for second color
 * @param {Array<number>} [background=[255, 255, 255, 1]] - Background color to composite against when colors have transparency
 * @returns {number} Contrast ratio (1-21)
 */
export const getContrastRatio = (
  rgba1,
  rgba2,
  background = [255, 255, 255, 1],
) => {
  // When colors have transparency (alpha < 1), we need to composite them
  // against a background to get their effective appearance
  const composited1 = compositeColor(rgba1, background);
  const composited2 = compositeColor(rgba2, background);

  const lum1 = getLuminance(composited1[0], composited1[1], composited1[2]);
  const lum2 = getLuminance(composited2[0], composited2[1], composited2[2]);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
};

/**
 * Composites a color with alpha over a background color
 * @param {Array<number>} foreground - [r, g, b, a] foreground color
 * @param {Array<number>} background - [r, g, b, a] background color
 * @returns {Array<number>} [r, g, b] composited color (alpha is flattened)
 */
const compositeColor = (foreground, background) => {
  const [fr, fg, fb, fa] = foreground;
  const [br, bg, bb, ba] = background;

  // No transparency: return the foreground color as-is
  if (fa === 1) {
    return [fr, fg, fb];
  }

  // Alpha compositing formula: C = αA * CA + αB * (1 - αA) * CB
  const alpha = fa + ba * (1 - fa);

  if (alpha === 0) {
    return [0, 0, 0];
  }

  const r = (fa * fr + ba * (1 - fa) * br) / alpha;
  const g = (fa * fg + ba * (1 - fa) * bg) / alpha;
  const b = (fa * fb + ba * (1 - fa) * bb) / alpha;

  return [Math.round(r), Math.round(g), Math.round(b)];
};

/**
 * Calculates the relative luminance of an RGB color
 * Based on WCAG 2.1 specification
 * @param {number} r - Red component (0-255)
 * @param {number} g - Green component (0-255)
 * @param {number} b - Blue component (0-255)
 * @returns {number} Relative luminance (0-1)
 */
export const getLuminance = (r, g, b) => {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};
