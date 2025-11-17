import { parseCSSColor, stringifyCSSColor } from "./color_parsing.js";
import { prefersDarkColors } from "./color_scheme.js";

/**
 * Resolves a color value, handling CSS custom properties and light-dark() function
 * @param {string} color - CSS color value (may include CSS variables, light-dark())
 * @param {Element} element - DOM element to resolve CSS variables and light-dark() against
 * @param {string} context - Return format: "js" for RGBA array, "css" for CSS string
 * @returns {Array<number>|string|null} [r, g, b, a] values, CSS string, or null if parsing fails
 */
export const resolveCSSColor = (color, element, context = "js") => {
  if (!color) {
    return null;
  }
  if (typeof color !== "string") {
    if (context === "js") {
      return color;
    }
    return null;
  }

  let resolvedColor = color;

  // Handle light-dark() function
  const lightDarkMatch = color.match(/light-dark\(([^,]+),([^)]+)\)/);
  if (lightDarkMatch) {
    const lightColor = lightDarkMatch[1].trim();
    const darkColor = lightDarkMatch[2].trim();

    // Select the appropriate color and recursively resolve it
    const prefersDark = prefersDarkColors(element);
    resolvedColor = prefersDark ? darkColor : lightColor;
    return resolveCSSColor(resolvedColor, element, context);
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
        // Recursively resolve in case the CSS variable contains light-dark() or other variables
        return resolveCSSColor(resolvedValue, element, context);
      }
      if (fallback) {
        // Recursively resolve fallback (in case it's also a CSS variable)
        return resolveCSSColor(fallback, element, context);
      }
    }
  }

  if (color.startsWith("--")) {
    console.warn(`found "${color}". Use "var(${color})" instead.`);
    return null;
  }

  // Parse the resolved color and return in the requested format
  const rgba = parseCSSColor(resolvedColor);

  if (context === "css") {
    return rgba ? stringifyCSSColor(rgba) : null;
  }

  return rgba;
};
