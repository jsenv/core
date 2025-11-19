import { parseCSSColor, stringifyCSSColor } from "./css_color.js";

/**
 * Parse a CSS border value into components
 * @param {string} borderValue - CSS border value like "2px solid red"
 * @returns {Object|null} Parsed border components {width, style, color} or null if invalid
 */
export const parseCSSBorder = (borderValue, element) => {
  if (!borderValue || borderValue === "none" || borderValue === "initial") {
    return null;
  }

  // Normalize whitespace and trim
  const normalizedValue = borderValue.trim().replace(/\s+/g, " ");

  // Handle transparent border case
  if (
    normalizedValue === "0px solid transparent" ||
    normalizedValue === "transparent"
  ) {
    return {
      width: 0,
      style: "solid",
      color: parseCSSColor("transparent"),
    };
  }

  // Split by spaces to get individual parts
  const parts = normalizedValue.split(" ");

  let width = null;
  let style = null;
  let color = null;

  for (const part of parts) {
    // Check if it's a width (starts with number or has px, em, etc.)
    if (
      /^\d/.test(part) ||
      /\d+(?:px|em|rem|ex|ch|vw|vh|vmin|vmax|cm|mm|in|pt|pc)$/.test(part)
    ) {
      width = parseFloat(part) || 0;
    }
    // Check if it's a border style
    else if (borderStyleSet.has(part.toLowerCase())) {
      style = part.toLowerCase();
    }
    // Assume it's a color
    else {
      color = part;
    }
  }

  // Set defaults for missing values
  width = width ?? 0;
  style = style || "solid";

  // Parse the color properly
  if (color) {
    color = parseCSSColor(color, element);
  } else {
    color = parseCSSColor("transparent");
  }

  return {
    width,
    style,
    color,
  };
};

const borderStyleSet = new Set([
  "none",
  "hidden",
  "dotted",
  "dashed",
  "solid",
  "double",
  "groove",
  "ridge",
  "inset",
  "outset",
]);

/**
 * Stringify border components back to a CSS border value
 * @param {Object} borderComponents - Border components {width, style, color}
 * @returns {string} CSS border value like "2px solid red"
 */
export const stringifyCSSBorder = (borderComponents) => {
  if (!borderComponents) {
    return "none";
  }

  const { width, style, color } = borderComponents;

  // Handle special cases
  if (width === 0 || style === "none") {
    return "none";
  }

  // Build border string
  const parts = [];

  if (width !== undefined && width !== null) {
    parts.push(`${width}px`);
  }

  if (style) {
    parts.push(style);
  }

  if (color) {
    // Stringify the parsed color back to CSS
    const colorString = stringifyCSSColor(color);
    if (colorString && colorString !== "transparent") {
      parts.push(colorString);
    } else if (colorString === "transparent") {
      parts.push("transparent");
    }
  }

  return parts.join(" ") || "none";
};
