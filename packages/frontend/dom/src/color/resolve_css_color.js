/**
 * Resolves a color value, handling CSS custom properties
 * @param {Element} element - DOM element to resolve CSS variables against
 * @param {string} color - CSS color value (may include CSS variables)
 * @returns {string} Resolved color value
 */
export const resolveCSSColor = (element, color) => {
  if (!color || typeof color !== "string") {
    return color;
  }

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
        return resolvedValue;
      }
      if (fallback) {
        // Recursively resolve fallback (in case it's also a CSS variable)
        return resolveCSSColor(element, fallback);
      }
    }
  }

  return color;
};
