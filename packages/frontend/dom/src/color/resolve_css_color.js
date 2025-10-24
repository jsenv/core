import { parseCSSColor } from "./color_parsing.js";

/**
 * Resolves a color value, handling CSS custom properties
 * @param {Element} element - DOM element to resolve CSS variables against
 * @param {string} color - CSS color value (may include CSS variables)
 * @returns {Array<number>|null} [r, g, b, a] values or null if parsing fails
 */
export const resolveCSSColor = (element, color) => {
  if (!color || typeof color !== "string") {
    return null;
  }

  let resolvedColor = color;

  // If it's a CSS custom property, resolve it using getComputedStyle
  if (color.includes("var(")) {
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
        return resolveCSSColor(element, fallback);
      }
    }
  }

  // Parse the resolved color and return RGB array
  return parseCSSColor(resolvedColor);
};
