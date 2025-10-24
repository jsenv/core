/**
 * Chooses between light and dark colors based on which provides better contrast against a background
 * @param {Element} element - DOM element to resolve CSS variables against
 * @param {string} backgroundColor - CSS color value (hex, rgb, hsl, CSS variable, etc.)
 * @param {string} lightColor - Light color option (typically for dark backgrounds)
 * @param {string} darkColor - Dark color option (typically for light backgrounds)
 * @returns {string} The color that provides better contrast (lightColor or darkColor)
 */
import { getContrastRatio } from "./color_constrast.js";
import { resolveCSSColor } from "./resolve_css_color.js";

export const pickLightOrDark = (
  element,
  backgroundColor,
  lightColor,
  darkColor,
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
