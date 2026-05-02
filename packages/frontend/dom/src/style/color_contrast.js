import { parseCSSColor } from "./parsing/css_color.js";

/**
 * Returns `"white"` or `"black"`, whichever provides better contrast against
 * the given background color, using OKLCH lightness (perceptually uniform).
 *
 * Uses a threshold of 0.5 on the OKLCH L axis (0–1 scale).
 * Colors with L > threshold are considered light → return "black".
 * Colors with L ≤ threshold are considered dark → return "white".
 *
 * @param {string} backgroundColor - CSS color value (hex, rgb, hsl, CSS variable, …)
 * @param {Element} [element] - DOM element used to resolve CSS variables / computed styles
 * @param {number} [lightnessThreshold=0.5] - OKLCH L threshold (0–1). Below → "white", above → "black".
 * @returns {"white"|"black"}
 * @example
 * contrastColor("#1a202c")    // "white"  (dark background)
 * contrastColor("#f5f5f5")    // "black"  (light background)
 * contrastColor("#e91e8c")    // "white"  (vivid pink, perceptually dark)
 */
export const contrastColor = (
  backgroundColor,
  element,
  lightnessThreshold = 0.5,
) => {
  const resolvedBgColor = parseCSSColor(backgroundColor, element);
  if (!resolvedBgColor) {
    return "white";
  }
  const [r, g, b] =
    resolvedBgColor[3] === 1
      ? resolvedBgColor
      : compositeColor(resolvedBgColor, WHITE_RGBA);
  const L = rgbToOklchL(r, g, b);
  return L <= lightnessThreshold ? "white" : "black";
};

/**
 * Resolves the OKLCH lightness of a CSS color (perceptually uniform, 0–1 scale).
 *
 * @param {string} color - CSS color value (hex, rgb, hsl, CSS variable, etc.)
 * @param {Element} [element] - DOM element to resolve CSS variables against
 * @returns {number|null} OKLCH L value (0–1), or null if color cannot be resolved
 * @example
 * resolveOklchLightness("#e91e8c") // ~0.56  (vivid pink feels medium-bright)
 * resolveOklchLightness("#4476ff") // ~0.53  (blue)
 * resolveOklchLightness("#1a202c") // ~0.22  (dark background)
 */
export const resolveOklchLightness = (color, element) => {
  const rgba = parseCSSColor(color, element);
  if (!rgba) {
    return null;
  }
  const [r, g, b] = rgba;
  return rgbToOklchL(r, g, b);
};

/**
 * Resolves the WCAG relative luminance of a CSS color (kept for backwards compatibility).
 * @deprecated Prefer resolveOklchLightness for perceptually uniform results.
 */
export const resolveColorLuminance = (color, element) => {
  const rgba = parseCSSColor(color, element);
  if (!rgba) {
    return null;
  }
  const [r, g, b] = rgba;
  return getLuminance(r, g, b);
};

const WHITE_RGBA = [255, 255, 255, 1];

/**
 * Converts sRGB (0–255 each) to OKLCH lightness L (0–1).
 * Implements the sRGB → Linear sRGB → XYZ D65 → OKLab → L pipeline.
 */
const rgbToOklchL = (r, g, b) => {
  // sRGB → linear
  const toLinear = (c) => {
    c = c / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);

  // Linear sRGB → LMS (Oklab M1 matrix)
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  // Cube root
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  // LMS → OKLab L
  return 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
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
