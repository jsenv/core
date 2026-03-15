/**
 * Returns `"white"` or `"black"`, whichever provides better contrast against
 * the given background color — mirroring the CSS `contrast-color()` function.
 *
 * `"white"` is preferred when both colors yield the same contrast ratio.
 *
 * @param {string} backgroundColor - CSS color value (hex, rgb, hsl, CSS variable, …)
 * @param {Element} [element] - DOM element used to resolve CSS variables / computed styles
 * @returns {"white"|"black"}
 * @example
 * contrastColor("#1a202c")                 // "white"  (dark background)
 * contrastColor("#f5f5f5")                 // "black"  (light background)
 * contrastColor("var(--bg)", el)             // "white" or "black"
 */

import { parseCSSColor } from "./parsing/css_color.js";

export const contrastColor = (backgroundColor, element) => {
  const resolvedBgColor = parseCSSColor(backgroundColor, element);
  if (!resolvedBgColor) {
    return "white";
  }

  // Composite against white when the background has transparency so the
  // luminance reflects what the user actually sees.
  const [r, g, b] =
    resolvedBgColor[3] === 1
      ? resolvedBgColor
      : compositeColor(resolvedBgColor, WHITE_RGBA);

  const bgLuminance = getLuminance(r, g, b);

  // One luminance comparison replaces two full contrast-ratio computations.
  // White wins (or ties) when bgLuminance <= the crossover point where both
  // colors yield identical ratios:
  //   contrastWithWhite = contrastWithBlack
  //   1.05 / (L + 0.05) = (L + 0.05) / 0.05
  //   L = √(1.05 × 0.05) − 0.05  ≈ 0.179
  return bgLuminance <= EQUAL_CONTRAST_LUMINANCE ? "white" : "black";
};

// Luminance threshold at which white and black yield the same contrast ratio
// against a background. Below → white wins or ties; above → black wins.
const EQUAL_CONTRAST_LUMINANCE = Math.sqrt(1.05 * 0.05) - 0.05;
const WHITE_RGBA = [255, 255, 255, 1];

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
