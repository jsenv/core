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
  // Basic colors
  black: [0, 0, 0],
  white: [255, 255, 255],
  red: [255, 0, 0],
  green: [0, 128, 0],
  blue: [0, 0, 255],
  yellow: [255, 255, 0],
  cyan: [0, 255, 255],
  magenta: [255, 0, 255],

  // Gray variations
  silver: [192, 192, 192],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
  darkgray: [169, 169, 169],
  darkgrey: [169, 169, 169],
  lightgray: [211, 211, 211],
  lightgrey: [211, 211, 211],
  dimgray: [105, 105, 105],
  dimgrey: [105, 105, 105],
  gainsboro: [220, 220, 220],
  whitesmoke: [245, 245, 245],

  // Extended basic colors
  maroon: [128, 0, 0],
  olive: [128, 128, 0],
  lime: [0, 255, 0],
  aqua: [0, 255, 255],
  teal: [0, 128, 128],
  navy: [0, 0, 128],
  fuchsia: [255, 0, 255],
  purple: [128, 0, 128],

  // Red variations
  darkred: [139, 0, 0],
  firebrick: [178, 34, 34],
  crimson: [220, 20, 60],
  indianred: [205, 92, 92],
  lightcoral: [240, 128, 128],
  salmon: [250, 128, 114],
  darksalmon: [233, 150, 122],
  lightsalmon: [255, 160, 122],

  // Pink variations
  pink: [255, 192, 203],
  lightpink: [255, 182, 193],
  hotpink: [255, 105, 180],
  deeppink: [255, 20, 147],
  mediumvioletred: [199, 21, 133],
  palevioletred: [219, 112, 147],

  // Orange variations
  orange: [255, 165, 0],
  darkorange: [255, 140, 0],
  orangered: [255, 69, 0],
  tomato: [255, 99, 71],
  coral: [255, 127, 80],

  // Yellow variations
  gold: [255, 215, 0],
  lightyellow: [255, 255, 224],
  lemonchiffon: [255, 250, 205],
  lightgoldenrodyellow: [250, 250, 210],
  papayawhip: [255, 239, 213],
  moccasin: [255, 228, 181],
  peachpuff: [255, 218, 185],
  palegoldenrod: [238, 232, 170],
  khaki: [240, 230, 140],
  darkkhaki: [189, 183, 107],

  // Green variations
  darkgreen: [0, 100, 0],
  forestgreen: [34, 139, 34],
  seagreen: [46, 139, 87],
  mediumseagreen: [60, 179, 113],
  springgreen: [0, 255, 127],
  mediumspringgreen: [0, 250, 154],
  lawngreen: [124, 252, 0],
  chartreuse: [127, 255, 0],
  greenyellow: [173, 255, 47],
  limegreen: [50, 205, 50],
  palegreen: [152, 251, 152],
  lightgreen: [144, 238, 144],
  mediumaquamarine: [102, 205, 170],
  aquamarine: [127, 255, 212],
  darkolivegreen: [85, 107, 47],
  olivedrab: [107, 142, 35],
  yellowgreen: [154, 205, 50],

  // Blue variations
  darkblue: [0, 0, 139],
  mediumblue: [0, 0, 205],
  royalblue: [65, 105, 225],
  steelblue: [70, 130, 180],
  dodgerblue: [30, 144, 255],
  deepskyblue: [0, 191, 255],
  skyblue: [135, 206, 235],
  lightskyblue: [135, 206, 250],
  lightblue: [173, 216, 230],
  powderblue: [176, 224, 230],
  lightcyan: [224, 255, 255],
  paleturquoise: [175, 238, 238],
  darkturquoise: [0, 206, 209],
  mediumturquoise: [72, 209, 204],
  turquoise: [64, 224, 208],
  cadetblue: [95, 158, 160],
  darkcyan: [0, 139, 139],
  lightseagreen: [32, 178, 170],

  // Purple variations
  indigo: [75, 0, 130],
  darkviolet: [148, 0, 211],
  blueviolet: [138, 43, 226],
  mediumpurple: [147, 112, 219],
  mediumslateblue: [123, 104, 238],
  slateblue: [106, 90, 205],
  darkslateblue: [72, 61, 139],
  lavender: [230, 230, 250],
  thistle: [216, 191, 216],
  plum: [221, 160, 221],
  violet: [238, 130, 238],
  orchid: [218, 112, 214],
  mediumorchid: [186, 85, 211],
  darkorchid: [153, 50, 204],
  darkmagenta: [139, 0, 139],

  // Brown variations
  brown: [165, 42, 42],
  saddlebrown: [139, 69, 19],
  sienna: [160, 82, 45],
  chocolate: [210, 105, 30],
  darkgoldenrod: [184, 134, 11],
  peru: [205, 133, 63],
  rosybrown: [188, 143, 143],
  goldenrod: [218, 165, 32],
  sandybrown: [244, 164, 96],
  tan: [210, 180, 140],
  burlywood: [222, 184, 135],
  wheat: [245, 222, 179],
  navajowhite: [255, 222, 173],
  bisque: [255, 228, 196],
  blanchedalmond: [255, 235, 205],
  cornsilk: [255, 248, 220],

  // Special colors
  transparent: [0, 0, 0], // Note: alpha will be 0 for transparent
  aliceblue: [240, 248, 255],
  antiquewhite: [250, 235, 215],
  azure: [240, 255, 255],
  beige: [245, 245, 220],
  honeydew: [240, 255, 240],
  ivory: [255, 255, 240],
  lavenderblush: [255, 240, 245],
  linen: [250, 240, 230],
  mintcream: [245, 255, 250],
  mistyrose: [255, 228, 225],
  oldlace: [253, 245, 230],
  seashell: [255, 245, 238],
  snow: [255, 250, 250],
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
