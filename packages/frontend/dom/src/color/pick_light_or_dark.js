/**
 * Chooses between light and dark colors based on which provides better contrast against a background
 * @param {Element} element - DOM element to resolve CSS variables against
 * @param {string} backgroundColor - CSS color value (hex, rgb, hsl, CSS variable, etc.)
 * @param {string} lightColor - Light color option (typically for dark backgrounds)
 * @param {string} darkColor - Dark color option (typically for light backgrounds)
 * @returns {string} The color that provides better contrast (lightColor or darkColor)
 */
import { getContrastRatio } from "./color_constrast.js";
import { parseColor } from "./color_parsing.js";
import { resolveCSSColor } from "./resolve_css_color.js";

export const pickLightOrDark = (
  element,
  backgroundColor,
  lightColor,
  darkColor,
) => {
  const resolvedBgColor = resolveCSSColor(element, backgroundColor);
  const resolvedLightColor = resolveCSSColor(element, lightColor);
  const resolvedDarkColor = resolveCSSColor(element, darkColor);

  const bgRgb = parseColor(resolvedBgColor);
  const lightRgb = parseColor(resolvedLightColor);
  const darkRgb = parseColor(resolvedDarkColor);

  if (!bgRgb || !lightRgb || !darkRgb) {
    // Fallback to light color if parsing fails
    return lightColor;
  }

  const contrastWithLight = getContrastRatio(bgRgb, lightRgb);
  const contrastWithDark = getContrastRatio(bgRgb, darkRgb);

  return contrastWithLight > contrastWithDark ? lightColor : darkColor;
};
