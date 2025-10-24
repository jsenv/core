import { parseCSSColor } from "./color_parsing.js";
import { isDarkMode } from "./is_dark_mode.js";

/**
 * Resolves a color value, handling CSS custom properties and light-dark() function
 * @param {string} color - CSS color value (may include CSS variables, light-dark())
 * @param {Element} element - DOM element to resolve CSS variables and light-dark() against
 * @returns {Array<number>|null} [r, g, b, a] values or null if parsing fails
 */
export const resolveCSSColor = (color, element) => {
  if (!color || typeof color !== "string") {
    return null;
  }

  let resolvedColor = color;

  // Handle light-dark() function
  const lightDarkMatch = color.match(/light-dark\(([^,]+),([^)]+)\)/);
  if (lightDarkMatch) {
    const lightColor = lightDarkMatch[1].trim();
    const darkColor = lightDarkMatch[2].trim();

    // Select the appropriate color and recursively resolve it
    const useDarkColor = isDarkMode(element);
    resolvedColor = useDarkColor ? darkColor : lightColor;
    return resolveCSSColor(resolvedColor, element);
  }

  // If it's a CSS custom property, resolve it using getComputedStyle
  if (resolvedColor.includes("var(")) {
    const computedStyle = getComputedStyle(element);

    // Handle var() syntax
    const varMatch = color.match(/var\(([^,)]+)(?:,([^)]+))?\)/);
    if (varMatch) {
      const propertyName = varMatch[1].trim();
      const fallback = varMatch[2]?.trim();

      const resolvedValue = computedStyle.getPropertyValue(propertyName).trim();
      if (resolvedValue) {
        resolvedColor = resolvedValue;
      } else if (fallback) {
        // Recursively resolve fallback (in case it's also a CSS variable)
        return resolveCSSColor(fallback, element);
      }
    }
  }

  // Parse the resolved color and return RGBA array
  return parseCSSColor(resolvedColor);
};
