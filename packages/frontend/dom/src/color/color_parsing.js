/**
 * Parses a CSS color string into RGBA values
 * Supports hex (#rgb, #rrggbb, #rrggbbaa), rgb(), rgba(), hsl(), hsla()
 * @param {string} color - CSS color string
 * @returns {Array<number>|null} [r, g, b, a] values or null if parsing fails
 */
export const parseCSSColor = (color) => {
  if (!color || typeof color !== "string") {
    return null;
  }

  color = color.trim().toLowerCase();

  // Hex colors
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      // #rgb -> #rrggbb
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return [r, g, b, 1];
    }
    if (hex.length === 6) {
      // #rrggbb
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return [r, g, b, 1];
    }
    if (hex.length === 8) {
      // #rrggbbaa
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = parseInt(hex.slice(6, 8), 16) / 255;
      return [r, g, b, a];
    }
  }

  // RGB/RGBA colors
  const rgbMatch = color.match(/rgba?\(([^)]+)\)/);
  if (rgbMatch) {
    const values = rgbMatch[1].split(",").map((v) => parseFloat(v.trim()));
    if (values.length >= 3) {
      const r = values[0];
      const g = values[1];
      const b = values[2];
      const a = values.length >= 4 ? values[3] : 1;
      return [r, g, b, a];
    }
  }

  // HSL/HSLA colors - convert to RGB
  const hslMatch = color.match(/hsla?\(([^)]+)\)/);
  if (hslMatch) {
    const values = hslMatch[1].split(",").map((v) => parseFloat(v.trim()));
    if (values.length >= 3) {
      const [h, s, l] = values;
      const a = values.length >= 4 ? values[3] : 1;
      const [r, g, b] = hslToRgb(h, s / 100, l / 100);
      return [r, g, b, a];
    }
  }

  // Named colors (basic set)
  if (namedColors[color]) {
    return [...namedColors[color], 1];
  }
  return null;
};

/**
 * Converts RGBA values back to a CSS color string
 * Prefers named colors when possible, then rgb() for opaque colors, rgba() for transparent
 * @param {Array<number>} rgba - [r, g, b, a] values
 * @returns {string|null} CSS color string or null if invalid input
 */
export const stringifyCSSColor = (rgba) => {
  if (!Array.isArray(rgba) || rgba.length < 3) {
    return null;
  }

  const [r, g, b, a = 1] = rgba;

  // Validate RGB values
  if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
    return null;
  }

  // Validate alpha value
  if (a < 0 || a > 1) {
    return null;
  }

  // Round RGB values to integers
  const rInt = Math.round(r);
  const gInt = Math.round(g);
  const bInt = Math.round(b);

  // Check for named colors (only for fully opaque colors)
  if (a === 1) {
    for (const [name, [nameR, nameG, nameB]] of Object.entries(namedColors)) {
      if (rInt === nameR && gInt === nameG && bInt === nameB) {
        return name;
      }
    }
  }

  // Use rgb() for opaque colors, rgba() for transparent
  if (a === 1) {
    return `rgb(${rInt}, ${gInt}, ${bInt})`;
  }
  return `rgba(${rInt}, ${gInt}, ${bInt}, ${a})`;
};

const namedColors = {
  black: [0, 0, 0],
  white: [255, 255, 255],
  red: [255, 0, 0],
  green: [0, 128, 0],
  blue: [0, 0, 255],
  yellow: [255, 255, 0],
  cyan: [0, 255, 255],
  magenta: [255, 0, 255],
  silver: [192, 192, 192],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
  maroon: [128, 0, 0],
  olive: [128, 128, 0],
  lime: [0, 255, 0],
  aqua: [0, 255, 255],
  teal: [0, 128, 128],
  navy: [0, 0, 128],
  fuchsia: [255, 0, 255],
  purple: [128, 0, 128],
};

/**
 * Converts HSL color to RGB
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-1)
 * @param {number} l - Lightness (0-1)
 * @returns {Array<number>} [r, g, b] values
 */
const hslToRgb = (h, s, l) => {
  h = h % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const createRgb = (r, g, b) => {
    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255),
    ];
  };

  if (h >= 0 && h < 60) {
    return createRgb(c, x, 0);
  }
  if (h >= 60 && h < 120) {
    return createRgb(x, c, 0);
  }
  if (h >= 120 && h < 180) {
    return createRgb(0, c, x);
  }
  if (h >= 180 && h < 240) {
    return createRgb(0, x, c);
  }
  if (h >= 240 && h < 300) {
    return createRgb(x, 0, c);
  }
  if (h >= 300 && h < 360) {
    return createRgb(c, 0, x);
  }

  return createRgb(0, 0, 0);
};
