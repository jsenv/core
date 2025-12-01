import { signal, effect } from "@preact/signals";
import { useState, useLayoutEffect } from "preact/hooks";

/**
 * Generates a unique signature for various types of elements that can be used for identification in logs.
 *
 * This function handles different types of elements and returns an appropriate identifier:
 * - For DOM elements: Creates a CSS selector using tag name, data-ui-name, ID, classes, or parent hierarchy
 * - For React/Preact elements (JSX): Returns JSX-like representation with type and props
 * - For functions: Returns function name and optional underlying element reference in brackets
 * - For null/undefined: Returns the string representation
 *
 * The returned signature for DOM elements is a valid CSS selector that can be copy-pasted
 * into browser dev tools to locate the element in the DOM.
 *
 * @param {HTMLElement|Object|Function|null|undefined} element - The element to generate a signature for
 * @returns {string} A unique identifier string in various formats depending on element type
 *
 * @example
 * // For DOM element with data-ui-name
 * // <div data-ui-name="header">
 * getElementSignature(element) // Returns: `div[data-ui-name="header"]`
 *
 * @example
 * // For DOM element with ID
 * // <div id="main" class="container active">
 * getElementSignature(element) // Returns: "div#main"
 *
 * @example
 * // For DOM element with classes only
 * // <button class="btn primary">
 * getElementSignature(element) // Returns: "button.btn.primary"
 *
 * @example
 * // For DOM element without distinguishing features (uses parent hierarchy)
 * // <p> inside <section id="content">
 * getElementSignature(element) // Returns: "section#content > p"
 *
 * @example
 * // For React/Preact element with props
 * // <MyComponent id="widget" />
 * getElementSignature(element) // Returns: `<MyComponent id="widget" />`
 *
 * @example
 * // For named function with underlying element reference
 * const MyComponent = () => {}; MyComponent.underlyingElementId = "div#main";
 * getElementSignature(MyComponent) // Returns: "[function MyComponent for div#main]"
 *
 * @example
 * // For anonymous function without underlying element
 * const anonymousFunc = () => {};
 * getElementSignature(anonymousFunc) // Returns: "[function]"
 *
 * @example
 * // For named function without underlying element
 * function namedHandler() {}
 * getElementSignature(namedHandler) // Returns: "[function namedHandler]"
 *
 * @example
 * // For null/undefined
 * getElementSignature(null) // Returns: "null"
 */
const getElementSignature = (element) => {
  if (Array.isArray(element)) {
    if (element.length === 0) {
      return "empty";
    }
    if (element.length === 1) {
      return getElementSignature(element[0]);
    }
    const parent = element[0].parentNode;
    return `${getElementSignature(parent)} children`;
  }
  if (!element) {
    return String(element);
  }
  if (typeof element === "string") {
    return element === ""
      ? "empty string"
      : element.length > 10
        ? `${element.slice(0, 10)}...`
        : element;
  }
  if (typeof element === "function") {
    const functionName = element.name;
    const functionLabel = functionName
      ? `function ${functionName}`
      : "function";
    const underlyingElementId = element.underlyingElementId;
    if (underlyingElementId) {
      return `[${functionLabel} for ${underlyingElementId}]`;
    }
    return `[${functionLabel}]`;
  }
  if (element.props) {
    const type = element.type;
    const elementName = typeof type === "function" ? type.name : type;
    const id = element.props.id;
    if (id) {
      return `<${elementName} id="${id}" />`;
    }
    return `<${elementName} />`;
  }
  if (element.nodeType === Node.TEXT_NODE) {
    return `#text(${getElementSignature(element.nodeValue)})`;
  }

  const tagName = element.tagName.toLowerCase();
  const dataUIName = element.getAttribute("data-ui-name");
  if (dataUIName) {
    return `${tagName}[data-ui-name="${dataUIName}"]`;
  }
  if (element === document.body) {
    return "<body>";
  }
  if (element === document.documentElement) {
    return "<html>";
  }
  const elementId = element.id;
  if (elementId) {
    return `${tagName}#${elementId}`;
  }
  const className = element.className;
  if (className) {
    return `${tagName}.${className.split(" ").join(".")}`;
  }

  const parentSignature = getElementSignature(element.parentElement);
  return `${parentSignature} > ${tagName}`;
};

const createIterableWeakSet = () => {
  const objectWeakRefSet = new Set();

  return {
    add: (object) => {
      const objectWeakRef = new WeakRef(object);
      objectWeakRefSet.add(objectWeakRef);
    },

    delete: (object) => {
      for (const weakRef of objectWeakRefSet) {
        if (weakRef.deref() === object) {
          objectWeakRefSet.delete(weakRef);
          return true;
        }
      }
      return false;
    },

    *[Symbol.iterator]() {
      for (const objectWeakRef of objectWeakRefSet) {
        const object = objectWeakRef.deref();
        if (object === undefined) {
          objectWeakRefSet.delete(objectWeakRef);
          continue;
        }
        yield object;
      }
    },

    has: (object) => {
      for (const weakRef of objectWeakRefSet) {
        const objectCandidate = weakRef.deref();
        if (objectCandidate === undefined) {
          objectWeakRefSet.delete(weakRef);
          continue;
        }
        if (objectCandidate === object) {
          return true;
        }
      }
      return false;
    },

    clear: () => {
      objectWeakRefSet.clear();
    },

    get size() {
      return objectWeakRefSet.size;
    },

    getStats: () => {
      let alive = 0;
      let dead = 0;
      for (const weakRef of objectWeakRefSet) {
        if (weakRef.deref() !== undefined) {
          alive++;
        } else {
          dead++;
        }
      }
      return { total: objectWeakRefSet.size, alive, dead };
    },
  };
};

const createPubSub = (clearOnPublish = false) => {
  const callbackSet = new Set();

  const publish = (...args) => {
    const results = [];
    for (const callback of callbackSet) {
      const result = callback(...args);
      results.push(result);
    }
    if (clearOnPublish) {
      callbackSet.clear();
    }
    return results;
  };

  const subscribe = (callback) => {
    if (typeof callback !== "function") {
      throw new TypeError("callback must be a function");
    }
    callbackSet.add(callback);
    return () => {
      callbackSet.delete(callback);
    };
  };

  const clear = () => {
    callbackSet.clear();
  };

  return [publish, subscribe, clear];
};

const createValueEffect = (value) => {
  const callbackSet = new Set();
  const valueCleanupSet = new Set();

  const cleanup = () => {
    for (const valueCleanup of valueCleanupSet) {
      valueCleanup();
    }
    valueCleanupSet.clear();
  };

  const updateValue = (newValue) => {
    if (newValue === value) {
      return;
    }
    cleanup();
    const oldValue = value;
    value = newValue;
    for (const callback of callbackSet) {
      const returnValue = callback(newValue, oldValue);
      if (typeof returnValue === "function") {
        valueCleanupSet.add(returnValue);
      }
    }
  };

  const addEffect = (callback) => {
    callbackSet.add(callback);
    return () => {
      callbackSet.delete(callback);
    };
  };

  return [updateValue, addEffect, cleanup];
};

// https://github.com/davidtheclark/tabbable/blob/master/index.js
const isDocumentElement = (node) =>
  node === node.ownerDocument.documentElement;

/**
 * elementToOwnerWindow returns the window owning the element.
 * Usually an element window will just be window.
 * But when an element is inside an iframe, the window of that element
 * is iframe.contentWindow
 * It's often important to work with the correct window because
 * element are scoped per iframes.
 */
const elementToOwnerWindow = (element) => {
  if (elementIsWindow(element)) {
    return element;
  }
  if (elementIsDocument(element)) {
    return element.defaultView;
  }
  return elementToOwnerDocument(element).defaultView;
};
/**
 * elementToOwnerDocument returns the document containing the element.
 * Usually an element document is window.document.
 * But when an element is inside an iframe, the document of that element
 * is iframe.contentWindow.document
 * It's often important to work with the correct document because
 * element are scoped per iframes.
 */
const elementToOwnerDocument = (element) => {
  if (elementIsWindow(element)) {
    return element.document;
  }
  if (elementIsDocument(element)) {
    return element;
  }
  return element.ownerDocument;
};

const elementIsWindow = (a) => a.window === a;
const elementIsDocument = (a) => a.nodeType === 9;
const elementIsDetails = ({ nodeName }) => nodeName === "DETAILS";
const elementIsSummary = ({ nodeName }) => nodeName === "SUMMARY";

// should be used ONLY when an element is related to other elements that are not descendants of this element
const getAssociatedElements = (element) => {
  if (element.tagName === "COL") {
    const columnCells = [];
    const colgroup = element.parentNode;
    const columnIndex = Array.from(colgroup.children).indexOf(element);
    const table = element.closest("table");
    const rows = table.querySelectorAll("tr");
    for (const row of rows) {
      const rowCells = row.children;
      for (const rowCell of rowCells) {
        if (rowCell.cellIndex === columnIndex) {
          columnCells.push(rowCell);
        }
      }
    }
    return columnCells;
  }
  // if (element.tagName === "TR") {
  //   const rowCells = Array.from(element.children);
  //   return rowCells;
  // }
  return null;
};

/**
 * Determines if the current color scheme is dark mode
 * @param {Element} [element] - DOM element to check color-scheme against (optional)
 * @returns {boolean} True if dark mode is active
 */
const prefersDarkColors = (element) => {
  const colorScheme = getPreferedColorScheme(element);
  return colorScheme.includes("dark");
};
const prefersLightColors = (element) => {
  return !prefersDarkColors(element);
};
const getPreferedColorScheme = (element) => {
  const computedStyle = getComputedStyle(element || document.documentElement);
  const colorScheme = computedStyle.colorScheme;

  // If no explicit color-scheme is set, or it's "normal",
  // fall back to prefers-color-scheme media query
  if (!colorScheme || colorScheme === "normal") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  return colorScheme;
};

const updateRGBA = (rgba, toUpdate) => {
  const copy = [...rgba];
  if (toUpdate.r !== undefined) {
    copy[0] = toUpdate.r;
  }
  if (toUpdate.g !== undefined) {
    copy[1] = toUpdate.g;
  }
  if (toUpdate.b !== undefined) {
    copy[2] = toUpdate.b;
  }
  if (toUpdate.a !== undefined) {
    copy[3] = toUpdate.a;
  }
  return copy;
};
const areSameRGBA = (first, second) => {
  const [r, g, b, a] = first;
  const [r2, g2, b2, a2] = second;
  return r === r2 && g === g2 && b === b2 && a === a2;
};
const resolveCSSColor = (color, element) => {
  const rgba = parseCSSColor(color, element);
  return stringifyCSSColor(rgba);
};

/**
 * Resolves a color value, handling CSS custom properties and light-dark() function
 * @param {string} color - CSS color value (may include CSS variables, light-dark())
 * @param {Element} element - DOM element to resolve CSS variables and light-dark() against
 * @param {string} context - Return format: "js" for RGBA array, "css" for CSS string
 * @returns {Array<number>|string|null} [r, g, b, a] values, CSS string, or null if parsing fails
 */
const parseCSSColor = (color, element) => {
  if (!color) {
    return null;
  }
  if (typeof color !== "string") {
    return color;
  }
  if (color === "inherit") {
    if (!element) {
      return color;
    }
    const computedStyle = getComputedStyle(element);
    const resolvedColor = parseCSSColor(computedStyle.color, element);
    return resolvedColor;
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
    return parseCSSColor(resolvedColor, element);
  }

  // If it's a CSS custom property, resolve it using getComputedStyle
  if (resolvedColor.includes("var(")) {
    if (!element) {
      // console.warn(`"${resolvedColor}" cannot be resolved without element.`);
      return resolvedColor;
    }
    const computedStyle = getComputedStyle(element);

    // Handle var() syntax
    const varMatch = color.match(/var\(([^,)]+)(?:,([^)]+))?\)/);
    if (varMatch) {
      const propertyName = varMatch[1].trim();
      const fallback = varMatch[2]?.trim();

      const resolvedValue = computedStyle.getPropertyValue(propertyName).trim();
      if (resolvedValue) {
        // Recursively resolve in case the CSS variable contains light-dark() or other variables
        return parseCSSColor(resolvedValue, element);
      }
      if (fallback) {
        // Recursively resolve fallback (in case it's also a CSS variable)
        return parseCSSColor(fallback, element);
      }
    }
  }

  if (color.startsWith("--")) {
    console.warn(`found "${color}". Use "var(${color})" instead.`);
    return null;
  }
  const rgba = convertColorToRgba(resolvedColor);
  return rgba;
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
/**
 * Parses a CSS color string into RGBA values
 * Supports hex (#rgb, #rrggbb, #rrggbbaa), rgb(), rgba(), hsl(), hsla()
 * @param {string} color - CSS color string
 * @returns {Array<number>|null} [r, g, b, a] values or null if parsing fails
 */
const convertColorToRgba = (color) => {
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

  if (color === "transparent") {
    return [0, 0, 0, 0];
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
const stringifyCSSColor = (value) => {
  if (typeof value === "string") {
    // can happen for css variables that we can't resolve
    return value;
  }
  if (!Array.isArray(value) || value.length < 3) {
    return null;
  }
  const rgba = value;
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
  if (a === 0 && rInt === 0 && gInt === 0 && bInt === 0) {
    return "transparent";
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

// Export named colors and create a Set of color keywords for efficient lookup
const cssColorKeywordSet = new Set([
  ...Object.keys(namedColors),
  "transparent",
  "currentcolor",
]);

// Shared tokenization utilities for CSS parsing

// Tokenize CSS string into individual values, respecting function boundaries
const tokenizeCSS = (cssString, options = {}) => {
  const {
    separators = [" "],
    preserveSeparators = false,
    respectFunctions = true,
  } = options;

  const tokens = [];
  let current = "";
  let depth = 0;
  let inFunction = false;

  for (let i = 0; i < cssString.length; i++) {
    const char = cssString[i];

    if (respectFunctions && char === "(") {
      depth++;
      inFunction = true;
      current += char;
    } else if (respectFunctions && char === ")") {
      depth--;
      current += char;
      if (depth === 0) {
        inFunction = false;
      }
    } else if (
      separators.includes(char) &&
      (!respectFunctions || (!inFunction && depth === 0))
    ) {
      if (current.trim()) {
        tokens.push(current.trim());
        current = "";
      }
      if (preserveSeparators) {
        tokens.push(char);
      }
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    tokens.push(current.trim());
  }

  return tokens;
};

// Split CSS string into layers/sections (handle commas not inside functions)
const splitCSSLayers = (cssString) => {
  const layers = [];
  let current = "";
  let depth = 0;

  for (let i = 0; i < cssString.length; i++) {
    const char = cssString[i];

    if (char === "(") {
      depth++;
    } else if (char === ")") {
      depth--;
    } else if (char === "," && depth === 0) {
      layers.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    layers.push(current.trim());
  }

  return layers;
};

// Convert image object to CSS string
const stringifyCSSImage = (imageObj) => {
  if (typeof imageObj === "string") {
    return imageObj;
  }

  if (typeof imageObj !== "object" || imageObj === null) {
    return imageObj;
  }

  switch (imageObj.type) {
    case "url":
      return `url(${imageObj.value})`;

    case "linear-gradient":
      return stringifyLinearGradient(imageObj);

    case "radial-gradient":
      return stringifyRadialGradient(imageObj);

    case "conic-gradient":
      return stringifyConicGradient(imageObj);

    case "repeating-linear-gradient":
      return `repeating-${stringifyLinearGradient(imageObj)}`;

    case "repeating-radial-gradient":
      return `repeating-${stringifyRadialGradient(imageObj)}`;

    case "repeating-conic-gradient":
      return `repeating-${stringifyConicGradient(imageObj)}`;

    default:
      // Fallback for unknown types
      return imageObj.original || "none";
  }
};

// Parse CSS image string into structured object
const parseCSSImage = (imageString, element) => {
  if (!imageString || imageString === "none") {
    return undefined;
  }

  if (typeof imageString !== "string") {
    return imageString;
  }

  const trimmed = imageString.trim();

  // Parse URL
  const urlMatch = trimmed.match(/^url\s*\(([^)]*)\)$/);
  if (urlMatch) {
    return {
      type: "url",
      value: cleanUrlValue(urlMatch[1]),
      original: trimmed,
    };
  }

  // Parse gradients
  const gradientMatch = trimmed.match(
    /^(repeating-)?(linear-gradient|radial-gradient|conic-gradient)\s*\(([\s\S]*)\)$/,
  );
  if (gradientMatch) {
    const [, repeating, gradientType, content] = gradientMatch;
    const type = repeating ? `repeating-${gradientType}` : gradientType;

    switch (gradientType) {
      case "linear-gradient":
        return parseLinearGradient(content, type, trimmed, element);
      case "radial-gradient":
        return parseRadialGradient(content, type, trimmed, element);
      case "conic-gradient":
        return parseConicGradient(content, type, trimmed, element);
    }
  }

  // Other image functions (element, cross-fade, etc.)
  const functionMatch = trimmed.match(/^([a-z-]+)\s*\(([\s\S]*)\)$/);
  if (functionMatch) {
    return {
      type: functionMatch[1],
      content: functionMatch[2],
      original: trimmed,
    };
  }

  // Fallback for unrecognized values
  return {
    type: "unknown",
    value: trimmed,
    original: trimmed,
  };
};

// Helper functions for gradient parsing
const parseLinearGradient = (content, type, original, element) => {
  const { direction, colors } = parseGradientContent(content, element, {
    isRadial: false,
  });

  return {
    type,
    direction: direction || "to bottom",
    colors,
    original,
  };
};

const parseRadialGradient = (content, type, original, element) => {
  const { shape, colors } = parseGradientContent(content, element, {
    isRadial: true,
  });

  return {
    type,
    shape: shape || "ellipse",
    colors,
    original,
  };
};

const parseConicGradient = (content, type, original, element) => {
  const { direction, colors } = parseGradientContent(content, element, {
    isConic: true,
  });

  return {
    type,
    from: direction || "0deg",
    colors,
    original,
  };
};

// Parse gradient content (colors and direction/shape)
const parseGradientContent = (content, element, { isRadial, isConic } = {}) => {
  const parts = tokenizeCSS(content, { separators: [","] });
  const colors = [];
  let direction = null;
  let shape = null;

  for (const part of parts) {
    const trimmedPart = part.trim();

    // Check if it's a direction/shape (before any colors)
    if (colors.length === 0) {
      if (isRadial && isRadialShape(trimmedPart)) {
        shape = trimmedPart;
        continue;
      } else if (!isRadial && !isConic && isLinearDirection(trimmedPart)) {
        direction = trimmedPart;
        continue;
      } else if (isConic && trimmedPart.startsWith("from ")) {
        // Conic gradient "from" direction - extract just the angle part
        direction = trimmedPart.substring(5).trim(); // Remove "from " prefix
        continue;
      }
    }

    // Parse as color stop
    const colorStop = parseColorStop(trimmedPart, element);
    if (colorStop) {
      colors.push(colorStop);
    }
  }

  return { direction, shape, colors };
};

// Parse individual color stop
const parseColorStop = (stopString, element) => {
  const trimmed = stopString.trim();

  // Match color with optional position
  // Examples: "red", "red 50%", "#ff0000 25% 75%", "rgba(255,0,0,0.5)", "rgb(0,122,204) 8px", "red 45deg", "blue 180deg"
  const colorMatch = trimmed.match(
    /^((?:rgb|hsl)a?\([^)]*\)|#[a-f0-9]{3,8}|[a-z](?:[a-z-]*[a-z])?|var\([^)]*\))(?:\s+([\d.]+(?:deg|turn|rad|grad|px|%|em|rem|vh|vw|ch|ex|cm|mm|in|pt|pc)?(?:\s+[\d.]+(?:deg|turn|rad|grad|px|%|em|rem|vh|vw|ch|ex|cm|mm|in|pt|pc)?)*)?)?$/i,
  );

  if (colorMatch) {
    const [, color, positions] = colorMatch;
    const stopStrings = positions ? positions.split(/\s+/) : [];

    // Parse stop positions into structured objects
    const stops =
      stopStrings.length > 0
        ? stopStrings.map((stop) => {
            const match = stop.match(/^([+-]?\d+(?:\.\d+)?|\d*\.\d+)(\D*)$/);
            if (match) {
              return {
                isNumeric: true,
                value: parseFloat(match[1]),
                unit: match[2] || "",
              };
            }
            return {
              isNumeric: false,
              value: stop,
              unit: "",
            };
          })
        : undefined;

    const result = {
      color: parseCSSColor(color.trim(), element),
      stops,
    };
    return result;
  }

  return null;
};

// Direction/shape detection helpers
const isLinearDirection = (value) => {
  return (
    value.includes("deg") ||
    value.includes("turn") ||
    value.includes("rad") ||
    value.includes("grad") ||
    value.startsWith("to ") ||
    ["top", "bottom", "left", "right"].some((dir) => value.includes(dir))
  );
};

const isRadialShape = (value) => {
  return (
    value.includes("circle") ||
    value.includes("ellipse") ||
    value.includes("at ") ||
    value.includes("closest") ||
    value.includes("farthest")
  );
};

// Stringification helpers
const stringifyLinearGradient = (gradientObj) => {
  const parts = [];

  if (gradientObj.direction && gradientObj.direction !== "to bottom") {
    parts.push(gradientObj.direction);
  }

  if (gradientObj.colors) {
    parts.push(...gradientObj.colors.map(stringifyColorStop));
  }

  return `linear-gradient(${parts.join(", ")})`;
};

const stringifyRadialGradient = (gradientObj) => {
  const parts = [];

  if (gradientObj.shape && gradientObj.shape !== "ellipse") {
    parts.push(gradientObj.shape);
  }

  if (gradientObj.colors) {
    parts.push(...gradientObj.colors.map(stringifyColorStop));
  }

  return `radial-gradient(${parts.join(", ")})`;
};

const stringifyConicGradient = (gradientObj) => {
  const parts = [];

  if (gradientObj.from && gradientObj.from !== "0deg") {
    parts.push(`from ${gradientObj.from}`);
  }

  if (gradientObj.colors) {
    parts.push(...gradientObj.colors.map(stringifyColorStop));
  }

  return `conic-gradient(${parts.join(", ")})`;
};

const stringifyColorStop = (colorStop) => {
  if (typeof colorStop === "string") {
    return colorStop;
  }

  // Convert color back to CSS string (handles both strings and structured colors)
  const colorString =
    typeof colorStop.color === "string"
      ? colorStop.color
      : stringifyCSSColor(colorStop.color);
  const parts = [colorString];

  if (colorStop.stops) {
    // Handle structured stop objects
    const stopStrings = colorStop.stops.map((stop) => {
      if (typeof stop === "string") {
        return stop;
      }
      // If it's a parsed object, reconstruct the string
      if (stop.isNumeric) {
        return `${stop.value}${stop.unit}`;
      }
      return stop.value;
    });
    parts.push(...stopStrings);
  }

  return parts.join(" ");
};

// Helper to clean URL values (remove quotes)
const cleanUrlValue = (urlValue) => {
  const trimmed = urlValue.trim();
  // Remove surrounding quotes if present
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

// Convert background object to CSS string
const stringifyCSSBackground = (backgroundObj, normalize) => {
  const parts = [];

  // Order matters for CSS background shorthand
  // background: [background-color] [background-image] [background-repeat]
  //            [background-attachment] [background-position] / [background-size]
  //            [background-clip] [background-origin]

  if (backgroundObj.image !== undefined) {
    const normalizedImage =
      typeof backgroundObj.image === "object" && backgroundObj.image !== null
        ? stringifyCSSImage(backgroundObj.image)
        : normalize(backgroundObj.image, "backgroundImage", "css");
    parts.push(normalizedImage);
  }

  if (backgroundObj.repeat !== undefined) {
    parts.push(backgroundObj.repeat);
  }

  if (backgroundObj.attachment !== undefined) {
    parts.push(backgroundObj.attachment);
  }

  if (backgroundObj.position !== undefined) {
    parts.push(backgroundObj.position);
  }

  if (backgroundObj.size !== undefined) {
    // background-size must be preceded by "/"
    parts.push(`/ ${backgroundObj.size}`);
  }

  if (backgroundObj.clip !== undefined) {
    parts.push(backgroundObj.clip);
  }

  if (backgroundObj.origin !== undefined) {
    parts.push(backgroundObj.origin);
  }

  if (backgroundObj.color !== undefined) {
    const normalizedColor = normalize(
      backgroundObj.color,
      "backgroundColor",
      "css",
    );
    parts.push(normalizedColor);
  }

  return parts.join(" ");
};

// Parse background CSS string into object
const parseCSSBackground = (
  backgroundString,
  { parseStyle, element },
) => {
  if (!backgroundString || backgroundString === "none") {
    return {};
  }
  if (backgroundString === "transparent") {
    return {
      color: parseStyle("transparent", "backgroundColor", element),
    };
  }

  // Handle simple cases first
  if (isSimpleColor(backgroundString)) {
    const normalizedColor = parseStyle(
      backgroundString,
      "backgroundColor",
      element,
    );
    return { color: normalizedColor };
  }

  // Complex background parsing - split by commas for multiple backgrounds
  const layers = splitCSSLayers(backgroundString);

  if (layers.length === 1) {
    return parseBackgroundLayer(layers[0], { parseStyle, element });
  }

  // Multiple background layers - return array
  return layers.map((layer) =>
    parseBackgroundLayer(layer, { parseStyle, element }),
  );
};

// Parse a single background layer
const parseBackgroundLayer = (layerString, { parseStyle, element }) => {
  const backgroundObj = {};
  const tokens = tokenizeCSS(layerString, {
    separators: [" ", "/"],
    preserveSeparators: true,
  });

  let i = 0;
  let expectingSize = false; // Track if we're after a "/" and expecting size
  let colorFound = false; // Track if we've already found a color

  while (i < tokens.length) {
    const token = tokens[i];

    // Skip spaces
    if (token === " ") {
      i++;
      continue;
    }

    // Skip "/" separator
    if (token === "/") {
      expectingSize = true;
      i++;
      continue;
    }

    // If we're expecting size after "/", parse size values
    if (expectingSize) {
      if (isNumericValue(token) || isSizeKeyword(token)) {
        // Collect all size tokens starting with current token
        const sizeTokens = [token]; // Start with current token
        i++; // Move to next token

        while (i < tokens.length && tokens[i] !== "/") {
          const currentToken = tokens[i];
          // Skip spaces
          if (currentToken === " ") {
            i++;
            continue;
          }
          // Check if it's a size/numeric value
          if (isNumericValue(currentToken) || isSizeKeyword(currentToken)) {
            sizeTokens.push(currentToken);
            i++;
          } else {
            // Hit a non-size value, stop collecting
            break;
          }
        }

        backgroundObj.size = sizeTokens.join(" ");
        expectingSize = false;
        continue; // Don't increment i since we're already positioned correctly
      } else {
        expectingSize = false; // Invalid size, continue with normal parsing
      }
    }

    // Check for colors early (can appear at the beginning or end)
    if (!colorFound && isSimpleColor(token)) {
      const normalizedColor = parseStyle(token, "backgroundColor", element);
      backgroundObj.color = normalizedColor;
      colorFound = true;
    }
    // Check for image functions (gradients, url) - can appear early
    else if (isImageFunction(token)) {
      const parsedImage = parseCSSImage(token, element);
      backgroundObj.image = parsedImage;
    }
    // Check for position values (appear before size, after image)
    else if (
      isPositionValue(token) ||
      (isNumericValue(token) && !expectingSize)
    ) {
      // Collect position tokens until we hit a "/" or non-position value
      const positionTokens = [token]; // Start with current token
      i++; // Move to next token

      while (i < tokens.length && tokens[i] !== "/") {
        const currentToken = tokens[i];
        // Skip spaces
        if (currentToken === " ") {
          i++;
          continue;
        }
        // Check if it's a position/numeric value
        if (isPositionValue(currentToken) || isNumericValue(currentToken)) {
          positionTokens.push(currentToken);
          i++;
        } else {
          // Hit a non-position value, stop collecting
          break;
        }
      }

      backgroundObj.position = positionTokens.join(" ");
      continue; // Don't increment i since we're already positioned correctly
    }
    // Check for repeat values (after position/size)
    else if (isRepeatValue(token)) {
      backgroundObj.repeat = token;
    }
    // Check for attachment values (after repeat)
    else if (isAttachmentValue(token)) {
      backgroundObj.attachment = token;
    }
    // Check for box values (origin/clip - near the end)
    else if (isBoxValue(token)) {
      // In CSS, origin comes before clip, but they can appear in either order
      if (backgroundObj.origin === undefined) {
        backgroundObj.origin = token;
      } else if (backgroundObj.clip === undefined) {
        backgroundObj.clip = token;
      }
      // If both are set, this might be a duplicate or error, but we'll take the last one
      else {
        backgroundObj.clip = token;
      }
    }

    i++;
  }

  return backgroundObj;
};

// Helper functions to identify token types
const isImageFunction = (value) => {
  return /^(?:url|linear-gradient|radial-gradient|conic-gradient|repeating-linear-gradient|repeating-radial-gradient|repeating-conic-gradient|image|element|cross-fade)\s*\(/.test(
    value,
  );
};

const isSimpleColor = (value) => {
  if (!value || typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();

  // Only match if it's a single word/token without spaces (except within parentheses)
  // This prevents matching colors within complex background strings
  if (trimmed.includes(" ")) {
    // Allow spaces only within function calls like rgb(255, 0, 0)
    const functionMatch = /^[a-z]+\s*\([^)]*\)$/i.test(trimmed);
    if (!functionMatch) {
      return false;
    }
  }

  // Hex colors: #rgb, #rrggbb, #rrggbbaa
  if (/^#[0-9a-f]{3,8}$/i.test(trimmed)) {
    return true;
  }

  // RGB/RGBA functions
  if (/^rgba?\s*\([^)]*\)$/i.test(trimmed)) {
    return true;
  }

  // HSL/HSLA functions
  if (/^hsla?\s*\([^)]*\)$/i.test(trimmed)) {
    return true;
  }

  // CSS color keywords using the imported Set
  if (cssColorKeywordSet.has(trimmed.toLowerCase())) {
    return true;
  }

  return false;
};

const isRepeatValue = (value) => {
  return [
    "repeat",
    "repeat-x",
    "repeat-y",
    "no-repeat",
    "space",
    "round",
  ].includes(value);
};

const isAttachmentValue = (value) => {
  return ["scroll", "fixed", "local"].includes(value);
};

const isPositionValue = (value) => {
  return ["left", "center", "right", "top", "bottom"].includes(value);
};

const isNumericValue = (value) => {
  return /^-?\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|ch|ex|cm|mm|in|pt|pc)?$/.test(
    value,
  );
};

const isSizeKeyword = (value) => {
  return ["auto", "contain", "cover"].includes(value);
};

const isBoxValue = (value) => {
  return ["border-box", "padding-box", "content-box", "text"].includes(value);
};

/**
 * Parse a CSS border value into components
 * @param {string} borderValue - CSS border value like "2px solid red"
 * @returns {Object|null} Parsed border components {width, style, color} or null if invalid
 */
const parseCSSBorder = (borderValue, element) => {
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

  // Use CSS tokenizer to split while respecting function boundaries
  const parts = tokenizeCSS(normalizedValue, {
    separators: [" "],
    respectFunctions: true,
  });

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
const stringifyCSSBorder = (borderComponents) => {
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

// Convert transform object to CSS string
const stringifyCSSTransform = (transformObj, normalize) => {
  const transforms = [];
  for (const key of Object.keys(transformObj)) {
    const transformPartValue = transformObj[key];
    const normalizedTransformPartValue = normalize(
      transformPartValue,
      key,
      "css",
    );
    transforms.push(`${key}(${normalizedTransformPartValue})`);
  }
  return transforms.join(" ");
};

// Parse transform CSS string into object
const parseCSSTransform = (transformString, normalize) => {
  if (!transformString || transformString === "none") {
    return undefined;
  }

  const transformObj = {};

  // Parse transform functions
  const transformPattern = /(\w+)\(([^)]+)\)/g;
  let match;

  while ((match = transformPattern.exec(transformString)) !== null) {
    const [, functionName, value] = match;

    // Handle matrix functions specially
    if (functionName === "matrix" || functionName === "matrix3d") {
      const matrixComponents = parseMatrixTransform(match[0]);
      if (matrixComponents) {
        // Only add non-default values to preserve original information
        Object.assign(transformObj, matrixComponents);
      }
      // If matrix can't be parsed to simple components, skip it (keep complex transforms as-is)
      continue;
    }

    // Handle regular transform functions
    const normalizedValue = normalize(value.trim(), functionName, "js");
    if (normalizedValue !== undefined) {
      transformObj[functionName] = normalizedValue;
    }
  }

  // Return undefined if no properties were extracted (preserves original information)
  return Object.keys(transformObj).length > 0 ? transformObj : undefined;
};
// Parse a matrix transform and extract simple transform components when possible
const parseMatrixTransform = (matrixString) => {
  // Match matrix() or matrix3d() functions
  const matrixMatch = matrixString.match(/matrix(?:3d)?\(([^)]+)\)/);
  if (!matrixMatch) {
    return null;
  }

  const values = matrixMatch[1].split(",").map((v) => parseFloat(v.trim()));

  if (matrixString.includes("matrix3d")) {
    // matrix3d(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p)
    if (values.length !== 16) {
      return null;
    }
    const [a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p] = values;
    // Check if it's a simple 2D transform (most common case)
    if (
      c === 0 &&
      d === 0 &&
      g === 0 &&
      h === 0 &&
      i === 0 &&
      j === 0 &&
      k === 1 &&
      l === 0 &&
      o === 0 &&
      p === 1
    ) {
      // This is essentially a 2D transform
      return parseSimple2DMatrix(a, b, e, f, m, n);
    }
    return null; // Complex 3D transform
  }
  // matrix(a, b, c, d, e, f)
  if (values.length !== 6) {
    return null;
  }
  const [a, b, c, d, e, f] = values;
  return parseSimple2DMatrix(a, b, c, d, e, f);
};
// Parse a simple 2D matrix into transform components
const parseSimple2DMatrix = (a, b, c, d, e, f) => {
  const result = {};

  // Extract translation - only add if not default (0)
  if (e !== 0) {
    result.translateX = e;
  }
  if (f !== 0) {
    result.translateY = f;
  }

  // Check for identity matrix (no transform)
  if (a === 1 && b === 0 && c === 0 && d === 1) {
    return result; // Only translation
  }

  // Decompose the 2D transformation matrix
  // Based on: https://frederic-wang.fr/decomposition-of-2d-transform-matrices.html

  const det = a * d - b * c;
  // Degenerate matrix (maps to a line or point)
  if (det === 0) {
    return null;
  }

  // Extract scale and rotation
  if (c === 0) {
    // Simple case: no skew
    if (a !== 1) {
      result.scaleX = a;
    }
    if (d !== 1) {
      result.scaleY = d;
    }
    if (b !== 0) {
      const angle = Math.atan(b / a) * (180 / Math.PI);
      if (angle !== 0) {
        result.rotate = angle;
      }
    }
    return result;
  }

  // General case: decompose using QR decomposition approach
  const scaleX = Math.sqrt(a * a + b * b);
  const scaleY = det / scaleX;
  const rotation = Math.atan2(b, a) * (180 / Math.PI);
  const skewX =
    Math.atan((a * c + b * d) / (scaleX * scaleX)) * (180 / Math.PI);
  if (scaleX !== 1) {
    result.scaleX = scaleX;
  }
  if (scaleY !== 1) {
    result.scaleY = scaleY;
  }
  if (rotation !== 0) {
    result.rotate = rotation;
  }
  if (skewX !== 0) {
    result.skewX = skewX;
  }
  return result;
};

const parseCSSWillChange = (willChangeString) => {
  if (!willChangeString || typeof willChangeString !== "string") {
    return [];
  }
  if (willChangeString === "auto") {
    return "auto";
  }
  return willChangeString
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
};

const stringifyCSSWillChange = (willChangeArray) => {
  if (!Array.isArray(willChangeArray) || willChangeArray.length === 0) {
    return "auto";
  }
  return willChangeArray.join(", ");
};

// Properties that can use px units
const pxPropertySet = new Set([
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "top",
  "left",
  "right",
  "bottom",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderWidth",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontSize",
  // lineHeight intentionally excluded - it should remain unitless when no unit is specified
  "letterSpacing",
  "wordSpacing",
  "translateX",
  "translateY",
  "translateZ",
  "borderRadius",
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomLeftRadius",
  "borderBottomRightRadius",
  "gap",
  "rowGap",
  "columnGap",
]);

// Properties that need deg units
const degPropertySet = new Set([
  "rotate",
  "rotateX",
  "rotateY",
  "rotateZ",
  "skew",
  "skewX",
  "skewY",
]);

// Properties that should remain unitless
const unitlessPropertySet = new Set([
  "opacity",
  "zIndex",
  "flexGrow",
  "flexShrink",
  "order",
  "columnCount",
  "scale",
  "scaleX",
  "scaleY",
  "scaleZ",
]);

// Well-known CSS units and keywords that indicate a value already has proper formatting
const cssSizeUnitSet = new Set([
  "px",
  "em",
  "rem",
  "ex",
  "ch",
  "vw",
  "vh",
  "dvw",
  "dvh",
  "svw",
  "svh",
  "lvw",
  "lvh",
  "vmin",
  "vmax",
  "cm",
  "mm",
  "in",
  "pt",
  "pc",
]);
const cssUnitSet = new Set([
  ...cssSizeUnitSet,
  "%",
  // Angle units
  "deg",
  "rad",
  "grad",
  "turn",
  // Time units
  "s",
  "ms",
  // Frequency units
  "Hz",
  "kHz",
]);
// Global CSS keywords that apply to any property
const globalCSSKeywordSet = new Set([
  "auto",
  "none",
  "inherit",
  "initial",
  "unset",
  "revert",
]);
// Keywords that should NOT get automatic units when used with properties from:
// - pxPropertySet (width, height, fontSize, etc.)
// - degPropertySet (rotate, skew, etc.)
// - unitlessPropertySet (opacity, zIndex, etc.)
// This prevents auto-unit addition: e.g., width: "auto" stays "auto", not "autopx"
const unitlessKeywordSet = new Set([
  ...globalCSSKeywordSet,
  // Size/dimension keywords for pxPropertySet properties
  "fit-content",
  "min-content",
  "max-content",
  // Font size keywords for fontSize
  "medium",
  "small",
  "large",
  "x-small",
  "x-large",
  "xx-small",
  "xx-large",
  "smaller",
  "larger",
  // Border width keywords for borderWidth properties
  "thin",
  "thick",
  // Line height keyword (though lineHeight is handled specially)
  "normal",
]);
// Keywords for backgroundImage property that should NOT be wrapped in url()
// Used to prevent: background: "none" becoming background: "url(none)"
const backgroundKeywordSet = new Set([
  ...globalCSSKeywordSet,
  // Background-specific keywords
  "transparent",
  "currentColor",
]);

const colorPropertySet = new Set([
  "outlineColor",
  "borderColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "backgroundColor",
  "color",
  "textDecorationColor",
  "textEmphasisColor",
  "caretColor",
  "columnRuleColor",
  "accentColor",
  "scrollbarColor",
  "stroke",
  "fill",
]);

const getUnit = (value) => {
  for (const cssUnit of cssUnitSet) {
    if (value.endsWith(cssUnit)) {
      return cssUnit;
    }
  }
  return "";
};
// Check if value already has a unit
const isUnitless = (value) => getUnit(value) === "";
const hasCSSSizeUnit = (value) => cssSizeUnitSet.has(getUnit(value));

// url(
// linear-gradient(
// radial-gradient(
// ...
const STARTS_WITH_CSS_IMAGE_FUNCTION_REGEX = /^[a-z-]+\(/;
// Normalize a single style value
const normalizeStyle = (
  value,
  propertyName,
  context = "js",
  element,
) => {
  if (propertyName === "transform") {
    if (context === "js") {
      if (typeof value === "string") {
        // For js context, prefer objects
        return parseCSSTransform(value, normalizeStyle);
      }
      // If code does transform: { translateX: "10px" }
      // we want to store { translateX: 10 }
      const transformNormalized = {};
      for (const key of Object.keys(value)) {
        const partValue = normalizeStyle(value[key], key, context, element);
        transformNormalized[key] = partValue;
      }
      return transformNormalized;
    }
    if (typeof value === "object" && value !== null) {
      // For CSS context, ensure transform is a string
      return stringifyCSSTransform(value, normalizeStyle);
    }
    return value;
  }

  if (propertyName === "willChange") {
    if (context === "js") {
      if (typeof value === "string") {
        // For js context, prefer arrays
        return parseCSSWillChange(value);
      }
      return value;
    }
    if (Array.isArray(value)) {
      // For CSS context, ensure willChange is a string
      return stringifyCSSWillChange(value);
    }
    return value;
  }

  if (propertyName === "background") {
    if (context === "js") {
      if (typeof value === "string") {
        // For js context, prefer objects
        return parseCSSBackground(value, {
          parseStyle,
          element,
        });
      }
      // If code does background: { color: "red", image: "url(...)" }
      // we want to normalize each part
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        const backgroundNormalized = {};
        for (const key of Object.keys(value)) {
          const partValue = normalizeStyle(
            value[key],
            `background${key.charAt(0).toUpperCase() + key.slice(1)}`,
            context,
            element,
          );
          backgroundNormalized[key] = partValue;
        }
        return backgroundNormalized;
      }
      return value;
    }
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      // For CSS context, ensure background is a string
      return stringifyCSSBackground(value, normalizeStyle);
    }
    return value;
  }

  if (propertyName === "border") {
    if (context === "js") {
      if (typeof value === "string") {
        // For js context, prefer objects
        return parseCSSBorder(value, element);
      }
      // If code does border: { width: 2, style: "solid", color: "red" }
      // we want to normalize each part
      if (value === null) {
        return null;
      }
      if (typeof value === "object") {
        const { width, style, color } = value;
        const borderNormalized = {
          width: normalizeStyle(width, "borderWidth", context, element),
          style: normalizeStyle(style, "borderStyle", context, element),
          color: normalizeStyle(color, "borderColor", context, element),
        };
        return borderNormalized;
      }
      return value;
    }
    if (typeof value !== "string") {
      return stringifyCSSBorder(value);
    }
    return value;
  }

  // Handle transform.* properties (e.g., "transform.translateX")
  if (propertyName.startsWith("transform.")) {
    if (context === "css") {
      console.warn(
        `normalizeStyle: magic properties like "${propertyName}" are not applicable in "css" context. Returning original value.`,
      );
      return value;
    }
    const transformProperty = propertyName.slice(10); // Remove "transform." prefix
    // If value is a CSS transform string, parse it first to extract the specific property
    if (typeof value === "string") {
      if (value === "none") {
        if (transformProperty.startsWith("scale")) {
          return 1;
        }
        // translate, rotate, skew
        return 0;
      }
      const parsedTransform = parseCSSTransform(value, normalizeStyle);
      return parsedTransform?.[transformProperty];
    }
    // If value is a transform object, extract the property directly
    if (typeof value === "object" && value !== null) {
      return value[transformProperty];
    }
    // never supposed to happen, the value given is neither string nor object
    return undefined;
  }

  if (propertyName === "backgroundImage") {
    if (context === "js") {
      if (typeof value === "string") {
        // For js context, prefer structured objects
        return parseCSSImage(value, element);
      }
      return value;
    }
    if (typeof value === "object" && value !== null) {
      // For CSS context, ensure backgroundImage is a string
      return stringifyCSSImage(value);
    }
    // Fallback: add url() wrapper if needed
    if (
      typeof value === "string" &&
      !backgroundKeywordSet.has(value) &&
      !STARTS_WITH_CSS_IMAGE_FUNCTION_REGEX.test(value)
    ) {
      return `url(${value})`;
    }
    return value;
  }

  if (propertyName === "lineHeight") {
    if (context === "js") {
      if (typeof value === "string") {
        const unit = getUnit(value);
        if (unit === "px") {
          const float = parseFloat(value);
          return float;
        }
        if (unit === "") {
          return `${value}em`;
        }
        return value;
      }
    }
    if (context === "css") {
      if (typeof value === "number") {
        // When line height is converted to a number it means
        // it was in pixels, we must restore the unit
        return `${value}px`;
      }
    }
    return value;
  }

  if (pxPropertySet.has(propertyName)) {
    return normalizeNumber(value, {
      propertyName,
      unit: "px",
      preferedType: context === "js" ? "number" : "string",
    });
  }
  if (degPropertySet.has(propertyName)) {
    return normalizeNumber(value, {
      propertyName,
      unit: "deg",
      preferedType: "string",
    });
  }
  if (unitlessPropertySet.has(propertyName)) {
    return normalizeNumber(value, {
      propertyName,
      unit: "",
      preferedType: context === "js" ? "number" : "string",
    });
  }

  if (colorPropertySet.has(propertyName)) {
    const rgba = parseCSSColor(value, element);
    if (context === "js") {
      return rgba;
    }
    return stringifyCSSColor(rgba);
  }

  return value;
};
const parseStyle = (value, propertyName, element) => {
  return normalizeStyle(value, propertyName, "js", element);
};
const stringifyStyle = (value, propertyName, element) => {
  return normalizeStyle(value, propertyName, "css", element);
};

const normalizeNumber = (value, { unit, propertyName, preferedType }) => {
  if (typeof value === "string") {
    // Keep strings as-is (including %, em, rem, auto, none, etc.)
    if (preferedType === "string") {
      if (unit && isUnitless(value) && !unitlessKeywordSet.has(value)) {
        return `${value}${unit}`;
      }
      return value;
    }
    // convert to number if possible (font-size: "12px" -> fontSize:12, opacity: "0.5" -> opacity: 0.5)
    if (!unit || value.endsWith(unit)) {
      const numericValue = parseFloat(value);
      if (!isNaN(numericValue)) {
        return numericValue;
      }
    }
    return value;
  }
  if (typeof value === "number") {
    if (isNaN(value)) {
      console.warn(`NaN found for "${propertyName}"`);
    }
    if (preferedType === "number") {
      return value;
    }
    // convert to string with unit
    return `${value}${unit}`;
  }

  return value;
};

// Normalize styles for DOM application
const normalizeStyles = (styles, context = "js", mutate = false) => {
  if (!styles) {
    return mutate ? styles : {};
  }
  if (typeof styles === "string") {
    styles = parseStyleString(styles, context);
    return styles;
  }
  if (mutate) {
    for (const key of Object.keys(styles)) {
      const value = styles[key];
      styles[key] = normalizeStyle(value, key, context);
    }
    return styles;
  }
  const normalized = {};
  for (const key of Object.keys(styles)) {
    const value = styles[key];
    if (value === undefined) {
      continue;
    }
    normalized[key] = normalizeStyle(value, key, context);
  }
  return normalized;
};

/**
 * Parses a CSS style string into a style object.
 * Handles CSS properties with proper camelCase conversion.
 *
 * @param {string} styleString - CSS style string like "color: red; font-size: 14px;"
 * @returns {object} Style object with camelCase properties
 */
const parseStyleString = (styleString, context = "js") => {
  const style = {};

  if (!styleString || typeof styleString !== "string") {
    return style;
  }

  // Split by semicolon and process each declaration
  const declarations = styleString.split(";");

  for (let declaration of declarations) {
    declaration = declaration.trim();
    if (!declaration) continue;

    const colonIndex = declaration.indexOf(":");
    if (colonIndex === -1) continue;

    const property = declaration.slice(0, colonIndex).trim();
    const value = declaration.slice(colonIndex + 1).trim();

    if (property && value) {
      // CSS custom properties (starting with --) should NOT be converted to camelCase
      if (property.startsWith("--")) {
        style[property] = normalizeStyle(value, property, context);
      } else {
        // Convert kebab-case to camelCase (e.g., "font-size" -> "fontSize")
        const camelCaseProperty = property.replace(
          /-([a-z])/g,
          (match, letter) => letter.toUpperCase(),
        );
        style[camelCaseProperty] = normalizeStyle(
          value,
          camelCaseProperty,
          context,
        );
      }
    }
  }

  return style;
};

const getComputedStyle$1 = (element) => {
  return elementToOwnerWindow(element).getComputedStyle(element);
};

const getStyle = (element, name, context) => {
  const computedStyle = getComputedStyle$1(element);
  const value = isCamelCase(name)
    ? computedStyle[name]
    : computedStyle.getPropertyValue(name);
  return normalizeStyle(value, name, context, element);
};

const isCamelCase = (str) => {
  // Check if string contains lowercase letter followed by uppercase letter (camelCase pattern)
  return /[a-z][A-Z]/.test(str);
};
const setStyle = (element, name, value) => {

  const prevValue = element.style[name];
  if (prevValue) {
    element.style.setProperty(name, value);
    return () => {
      element.style.setProperty(name, prevValue);
    };
  }
  element.style.setProperty(name, value);
  return () => {
    element.style.removeProperty(name);
  };
};
const forceStyle = (element, name, value) => {
  const inlineStyleValue = element.style[name];
  if (inlineStyleValue === value) {
    return () => {};
  }
  const computedStyleValue = getStyle(element, name);
  if (computedStyleValue === value) {
    return () => {};
  }
  const restoreStyle = setStyle(element, name, value);
  return restoreStyle;
};

const createSetMany$1 = (setter) => {
  return (element, description) => {
    const cleanupCallbackSet = new Set();
    for (const name of Object.keys(description)) {
      const value = description[name];
      const restoreStyle = setter(element, name, value);
      cleanupCallbackSet.add(restoreStyle);
    }
    return () => {
      for (const cleanupCallback of cleanupCallbackSet) {
        cleanupCallback();
      }
      cleanupCallbackSet.clear();
    };
  };
};

const setStyles = createSetMany$1(setStyle);
const forceStyles = createSetMany$1(forceStyle);

// Merge two style objects, handling special cases like transform
const mergeTwoStyles = (stylesA, stylesB, context = "js") => {
  if (!stylesA) {
    return normalizeStyles(stylesB, context);
  }
  if (!stylesB) {
    return normalizeStyles(stylesA, context);
  }
  const result = {};
  const aKeys = Object.keys(stylesA);
  // in case stylesB is a string we first parse it
  stylesB = normalizeStyles(stylesB, context);
  if (aKeys.length === 0) {
    return stylesB;
  }
  const bKeyToVisitSet = new Set(Object.keys(stylesB));
  for (const aKey of aKeys) {
    const bHasKey = bKeyToVisitSet.has(aKey);
    if (bHasKey) {
      bKeyToVisitSet.delete(aKey);
      result[aKey] = mergeOneStyle(stylesA[aKey], stylesB[aKey], aKey, context);
    } else {
      result[aKey] = normalizeStyle(stylesA[aKey], aKey, context);
    }
  }
  for (const bKey of bKeyToVisitSet) {
    result[bKey] = stylesB[bKey];
  }
  return result;
};

const appendStyles = (
  stylesAObject,
  stylesBNormalized,
  context = "js",
) => {
  const aKeys = Object.keys(stylesAObject);
  const bKeys = Object.keys(stylesBNormalized);
  for (const bKey of bKeys) {
    const aHasKey = aKeys.includes(bKey);
    if (aHasKey) {
      stylesAObject[bKey] = mergeOneStyle(
        stylesAObject[bKey],
        stylesBNormalized[bKey],
        bKey,
        context,
      );
    } else {
      stylesAObject[bKey] = stylesBNormalized[bKey];
    }
  }
  return stylesAObject;
};

// Merge a single style property value with an existing value
const mergeOneStyle = (
  existingValue,
  newValue,
  propertyName,
  context = "js",
) => {
  if (propertyName === "transform") {
    // Matrix parsing is now handled automatically in parseCSSTransform

    // Determine the types
    const existingIsString =
      typeof existingValue === "string" && existingValue !== "none";
    const newIsString = typeof newValue === "string" && newValue !== "none";
    const existingIsObject =
      typeof existingValue === "object" && existingValue !== null;
    const newIsObject = typeof newValue === "object" && newValue !== null;

    // Case 1: Both are objects - merge directly
    if (existingIsObject && newIsObject) {
      const merged = { ...existingValue, ...newValue };
      return context === "css"
        ? stringifyCSSTransform(merged, normalizeStyle)
        : merged;
    }

    // Case 2: New is object, existing is string - parse existing and merge
    if (newIsObject && existingIsString) {
      const parsedExisting = parseCSSTransform(existingValue, normalizeStyle);
      const merged = { ...parsedExisting, ...newValue };
      return context === "css"
        ? stringifyCSSTransform(merged, normalizeStyle)
        : merged;
    }

    // Case 3: New is string, existing is object - parse new and merge
    if (newIsString && existingIsObject) {
      const parsedNew = parseCSSTransform(newValue, normalizeStyle);
      const merged = { ...existingValue, ...parsedNew };
      return context === "css"
        ? stringifyCSSTransform(merged, normalizeStyle)
        : merged;
    }

    // Case 4: Both are strings - parse both and merge
    if (existingIsString && newIsString) {
      const parsedExisting = parseCSSTransform(existingValue, normalizeStyle);
      const parsedNew = parseCSSTransform(newValue, normalizeStyle);
      const merged = { ...parsedExisting, ...parsedNew };
      return context === "css"
        ? stringifyCSSTransform(merged, normalizeStyle)
        : merged;
    }

    // Case 5: New is object, no existing or existing is none/null
    if (newIsObject) {
      return context === "css"
        ? stringifyCSSTransform(newValue, normalizeStyle)
        : newValue;
    }

    // Case 6: New is string, no existing or existing is none/null
    if (newIsString) {
      if (context === "css") {
        return newValue; // Already a string
      }
      return parseCSSTransform(newValue, normalizeStyle); // Convert to object
    }
    return newValue;
  }

  if (propertyName === "willChange") {
    const existingIsString = typeof existingValue === "string";
    const newIsString = typeof newValue === "string";
    const existingIsArray = Array.isArray(existingValue);
    const newIsArray = Array.isArray(newValue);

    // Case 1: Both are arrays - merge directly
    if (existingIsArray && newIsArray) {
      const merged = [...new Set([...existingValue, ...newValue])];
      if (context === "css") {
        return stringifyCSSWillChange(merged);
      }
      return merged;
    }

    // Case 2: New is array, existing is string - parse existing and merge
    if (newIsArray && existingIsString) {
      const existingArray = parseCSSWillChange(existingValue);
      const merged = [...new Set([...existingArray, ...newValue])];
      if (context === "css") {
        return stringifyCSSWillChange(merged);
      }
      return merged;
    }

    // Case 3: New is string, existing is array - parse new and merge
    if (newIsString && existingIsArray) {
      const newArray = parseCSSWillChange(newValue);
      const merged = [...new Set([...existingValue, ...newArray])];
      if (context === "css") {
        return stringifyCSSWillChange(merged);
      }
      return merged;
    }

    // Case 4: Both are strings - parse both and merge
    if (existingIsString && newIsString) {
      const existingArray = parseCSSWillChange(existingValue);
      const newArray = parseCSSWillChange(newValue);
      const merged = [...new Set([...existingArray, ...newArray])];
      if (context === "css") {
        return stringifyCSSWillChange(merged);
      }
      return merged;
    }

    // Case 5: New is array, no existing or existing is null/undefined
    if (newIsArray) {
      if (context === "css") {
        return stringifyCSSWillChange(newValue);
      }
      return newValue;
    }

    // Case 6: New is string, no existing or existing is null/undefined
    if (newIsString) {
      if (context === "css") {
        return newValue;
      }
      const parsed = parseCSSWillChange(newValue);
      return parsed;
    }
    // Fallback: return newValue as is
    return newValue;
  }

  // For all other properties, simple replacement
  return newValue;
};

/**
 * Style Controller System
 *
 * Solves CSS style manipulation problems in JavaScript:
 *
 * ## Main problems:
 * 1. **Temporary style override**: Code wants to read current style, force another style,
 *    then restore original. With inline styles this is ugly and loses original info.
 * 2. **Multiple code parts**: When different parts of code want to touch styles simultaneously,
 *    they step on each other (rare but happens).
 * 3. **Transform composition**: CSS transforms are especially painful - you want to keep
 *    existing transforms but force specific parts (e.g., keep `rotate(45deg)` but override
 *    `translateX`). Native CSS overwrites the entire transform property.
 *
 * ## Solution:
 * Controller pattern + Web Animations API to preserve inline styles. Code that sets
 * inline styles expects to find them unchanged - we use animations for clean override:
 *
 * ```js
 * const controller = createStyleController("myFeature");
 *
 * // Smart value conversion (100 → "100px", 45 → "45deg")
 * controller.set(element, {
 *   transform: { translateX: 100, rotate: 45 }, // Individual transform properties
 *   opacity: 0.5
 * });
 *
 * // Transform objects merged intelligently
 * controller.set(element, {
 *   transform: { translateX: 50 } // Merges with existing transforms
 * });
 *
 * // Get underlying value without this controller's influence
 * const originalOpacity = controller.getUnderlyingValue(element, "opacity");
 * const originalTranslateX = controller.getUnderlyingValue(element, "transform.translateX"); // Magic dot notation!
 * const actualWidth = controller.getUnderlyingValue(element, "rect.width"); // Layout measurements
 *
 * controller.delete(element, "opacity"); // Only removes opacity, keeps transform
 * controller.clear(element); // Removes all styles from this controller only
 * controller.clearAll(); // Cleanup when done
 * ```
 *
 * **Key features:**
 * - **Transform composition**: Intelligently merges transform components instead of overwriting
 * - **Magic properties**: Access transform components with dot notation (e.g., "transform.translateX")
 * - **Layout measurements**: Access actual rendered dimensions with rect.* (e.g., "rect.width")
 * - **getUnderlyingValue()**: Read the "natural" value without this controller's influence
 * - **Smart units**: Numeric values get appropriate units automatically (px, deg, unitless)
 *
 * **Transform limitations:**
 * - **3D Transforms**: Complex `matrix3d()` transforms are preserved as-is and cannot be decomposed
 *   into individual properties. Only `matrix3d()` that represent simple 2D transforms are converted
 *   to object notation. Magic properties like "transform.rotateX" work only with explicit CSS functions,
 *   not with complex 3D matrices.
 *
 * Multiple controllers can safely manage the same element without conflicts.
 */


// Global registry to track which controllers are managing each element's styles
const elementControllerSetRegistry = new WeakMap(); // element -> Set<controller>

// Top-level helpers for controller attachment tracking
const onElementControllerAdded = (element, controller) => {
  if (!elementControllerSetRegistry.has(element)) {
    elementControllerSetRegistry.set(element, new Set());
  }
  const elementControllerSet = elementControllerSetRegistry.get(element);
  elementControllerSet.add(controller);
};
const onElementControllerRemoved = (element, controller) => {
  const elementControllerSet = elementControllerSetRegistry.get(element);
  if (elementControllerSet) {
    elementControllerSet.delete(controller);

    // Clean up empty element registry
    if (elementControllerSet.size === 0) {
      elementControllerSetRegistry.delete(element);
    }
  }
};

/**
 * Creates a style controller that can safely manage CSS styles on DOM elements.
 *
 * Uses Web Animations API to override styles without touching inline styles,
 * allowing multiple controllers to work together and providing intelligent transform composition.
 *
 * @param {string} [name="anonymous"] - Debug name for the controller
 * @returns {Object} Controller with methods: set, get, delete, getUnderlyingValue, commit, clear, clearAll
 *
 * @example
 * const controller = createStyleController("myFeature");
 * controller.set(element, { opacity: 0.5, transform: { translateX: 100 } });
 * controller.getUnderlyingValue(element, "opacity"); // Read value without controller influence
 * controller.clearAll(); // Cleanup
 */
const createStyleController = (name = "anonymous") => {
  // Store element data for this controller: element -> { styles, animation }
  const elementWeakMap = new WeakMap();

  const set = (element, stylesToSet) => {
    if (!element || typeof element !== "object") {
      throw new Error("Element must be a valid DOM element");
    }
    if (!stylesToSet || typeof stylesToSet !== "object") {
      throw new Error("styles must be an object");
    }

    const elementData = elementWeakMap.get(element);
    if (!elementData) {
      const normalizedStylesToSet = normalizeStyles(stylesToSet, "js");
      const animation = createAnimationForStyles(
        element,
        normalizedStylesToSet,
        name,
      );
      elementWeakMap.set(element, {
        styles: normalizedStylesToSet,
        animation,
      });
      onElementControllerAdded(element, controller);
      return;
    }

    const { styles, animation } = elementData;
    const mergedStyles = mergeTwoStyles(styles, stylesToSet);
    elementData.styles = mergedStyles;
    updateAnimationStyles(animation, mergedStyles);
  };

  const get = (element, propertyName) => {
    const elementData = elementWeakMap.get(element);
    if (!elementData) {
      return undefined;
    }
    const { styles } = elementData;
    if (propertyName === undefined) {
      return { ...styles };
    }
    if (propertyName.startsWith("transform.")) {
      const transformProp = propertyName.slice("transform.".length);
      return styles.transform?.[transformProp];
    }
    return styles[propertyName];
  };

  const deleteMethod = (element, propertyName) => {
    const elementData = elementWeakMap.get(element);
    if (!elementData) {
      return;
    }
    const { styles, animation } = elementData;
    if (propertyName.startsWith("transform.")) {
      const transformProp = propertyName.slice("transform.".length);
      const transformObject = styles.transform;
      if (!transformObject) {
        return;
      }
      const hasTransformProp = Object.hasOwn(transformObject, transformProp);
      if (!hasTransformProp) {
        return;
      }
      delete transformObject[transformProp];
      if (Object.keys(transformObject).length === 0) {
        delete styles.transform;
      }
    } else {
      const hasStyle = Object.hasOwn(styles, propertyName);
      if (!hasStyle) {
        return;
      }
      delete styles[propertyName];
    }
    const isEmpty = Object.keys(styles).length === 0;
    // Clean up empty controller
    if (isEmpty) {
      animation.cancel();
      elementWeakMap.delete(element);
      onElementControllerRemoved(element, controller);
      return;
    }
    updateAnimationStyles(animation, styles);
  };

  const commit = (element) => {
    const elementData = elementWeakMap.get(element);
    if (!elementData) {
      return; // Nothing to commit on this element for this controller
    }
    const { styles, animation } = elementData;
    // Cancel our animation permanently since we're committing styles to inline
    // (Keep this BEFORE getComputedStyle to prevent computedStyle reading our animation styles)
    animation.cancel();
    // Now read the true underlying styles (without our animation influence)
    const computedStyles = getComputedStyle(element);
    // Convert controller styles to CSS and commit to inline styles
    const cssStyles = normalizeStyles(styles, "css");
    for (const [key, value] of Object.entries(cssStyles)) {
      // Merge with existing computed styles for all properties
      const existingValue = computedStyles[key];
      element.style[key] = mergeOneStyle(existingValue, value, key, "css");
    }
    // Clear this controller's styles since they're now inline
    elementWeakMap.delete(element);
    // Clean up controller from element registry
    onElementControllerRemoved(element, controller);
  };

  const clear = (element) => {
    const elementData = elementWeakMap.get(element);
    if (!elementData) {
      return;
    }
    const { animation } = elementData;
    animation.cancel();
    elementWeakMap.delete(element);
    onElementControllerRemoved(element, controller);
  };

  const getUnderlyingValue = (element, propertyName) => {
    const elementControllerSet = elementControllerSetRegistry.get(element);

    const normalizeValueForJs = (value) => {
      // Use parseStyle to handle all property types including transform dot notation
      return parseStyle(value, propertyName, element);
    };

    const getFromOtherControllers = () => {
      if (!elementControllerSet || elementControllerSet.size <= 1) {
        return undefined;
      }

      let resultValue;
      for (const otherController of elementControllerSet) {
        if (otherController === controller) continue;
        const otherStyles = otherController.get(element);
        if (propertyName in otherStyles) {
          resultValue = mergeOneStyle(
            resultValue,
            otherStyles[propertyName],
            propertyName,
          );
        }
      }

      // Note: For CSS width/height properties, we can trust the values from other controllers
      // because we assume box-sizing: border-box. If the element used content-box,
      // the CSS width/height would differ from getBoundingClientRect() due to padding/borders,
      // but since controllers set the final rendered size, the CSS value is what matters.
      // For actual layout measurements, use rect.* properties instead.
      return normalizeValueForJs(resultValue);
    };

    const getFromDOM = () => {
      // Handle transform dot notation
      if (propertyName.startsWith("transform.")) {
        const transformValue = getComputedStyle(element).transform;
        return normalizeValueForJs(transformValue);
      }
      // For all other CSS properties, use computed styles
      const computedValue = getComputedStyle(element)[propertyName];
      return normalizeValueForJs(computedValue);
    };

    const getFromDOMLayout = () => {
      // For rect.* properties that reflect actual layout, always read from DOM
      // These represent the actual rendered dimensions, bypassing any controller influence
      if (propertyName === "rect.width") {
        return element.getBoundingClientRect().width;
      }
      if (propertyName === "rect.height") {
        return element.getBoundingClientRect().height;
      }
      if (propertyName === "rect.left") {
        return element.getBoundingClientRect().left;
      }
      if (propertyName === "rect.top") {
        return element.getBoundingClientRect().top;
      }
      if (propertyName === "rect.right") {
        return element.getBoundingClientRect().right;
      }
      if (propertyName === "rect.bottom") {
        return element.getBoundingClientRect().bottom;
      }
      return undefined;
    };

    const getWhileDisablingThisController = (fn) => {
      const elementData = elementWeakMap.get(element);
      if (!elementData) {
        return fn();
      }
      const { styles, animation } = elementData;
      // Temporarily cancel our animation to read underlying value
      animation.cancel();
      const underlyingValue = fn();
      // Restore our animation
      elementData.animation = createAnimationForStyles(element, styles, name);
      return underlyingValue;
    };

    if (typeof propertyName === "function") {
      return getWhileDisablingThisController(propertyName);
    }

    // Handle computed layout properties (rect.*) - always read from DOM, bypass controllers
    if (propertyName.startsWith("rect.")) {
      return getWhileDisablingThisController(getFromDOMLayout);
    }
    if (!elementControllerSet || !elementControllerSet.has(controller)) {
      // This controller is not applied, just read current value
      return getFromDOM();
    }
    // Check if other controllers would provide this style
    const valueFromOtherControllers = getFromOtherControllers();
    if (valueFromOtherControllers !== undefined) {
      return valueFromOtherControllers;
    }
    return getWhileDisablingThisController(getFromDOM);
  };

  const clearAll = () => {
    // Remove this controller from all elements and clean up animations
    for (const [
      element,
      elementControllerSet,
    ] of elementControllerSetRegistry) {
      if (!elementControllerSet.has(controller)) {
        continue;
      }
      const elementData = elementWeakMap.get(element);
      if (!elementData) {
        continue;
      }
      const { animation } = elementData;
      animation.cancel();
      elementWeakMap.delete(element);
      onElementControllerRemoved(element, controller);
    }
  };
  const controller = {
    name,
    set,
    get,
    delete: deleteMethod,
    getUnderlyingValue,
    commit,
    clear,
    clearAll,
  };

  return controller;
};

const getStyleForKeyframe = (styles) => {
  const cssStyles = normalizeStyles(styles, "css");
  return cssStyles;
};
const createAnimationForStyles = (element, styles, id) => {
  const cssStylesToSet = getStyleForKeyframe(styles);
  const animation = element.animate([cssStylesToSet], {
    duration: 0,
    fill: "forwards",
  });
  animation.id = id; // Set a debug name for this animation
  animation.play();
  animation.pause();
  return animation; // Return the created animation
};

const updateAnimationStyles = (animation, styles) => {
  const cssStyles = getStyleForKeyframe(styles);
  animation.effect.setKeyframes([cssStyles]);
  animation.play();
  animation.pause();
};

const dormantStyleController = createStyleController("dormant");
const getOpacity = (
  element,
  styleControllerToIgnore = dormantStyleController,
) => {
  return styleControllerToIgnore.getUnderlyingValue(element, "opacity");
};
const getTranslateX = (
  element,
  styleControllerToIgnore = dormantStyleController,
) => {
  return styleControllerToIgnore.getUnderlyingValue(
    element,
    "transform.translateX",
  );
};
const getTranslateY = (
  element,
  styleControllerToIgnore = dormantStyleController,
) => {
  return styleControllerToIgnore.getUnderlyingValue(
    element,
    "transform.translateY",
  );
};
const getWidth$1 = (
  element,
  styleControllerToIgnore = dormantStyleController,
) => {
  return styleControllerToIgnore.getUnderlyingValue(element, "rect.width");
};
const getHeight$1 = (
  element,
  styleControllerToIgnore = dormantStyleController,
) => {
  return styleControllerToIgnore.getUnderlyingValue(element, "rect.height");
};
const getBorderRadius = (
  element,
  styleControllerToIgnore = dormantStyleController,
) => {
  return styleControllerToIgnore.getUnderlyingValue(element, "borderRadius");
};
const getBorder = (
  element,
  styleControllerToIgnore = dormantStyleController,
) => {
  return styleControllerToIgnore.getUnderlyingValue(element, "border");
};
const getBackground = (
  element,
  styleControllerToIgnore = dormantStyleController,
) => {
  return styleControllerToIgnore.getUnderlyingValue(element, "background");
};
const getBackgroundColor = (
  element,
  styleControllerToIgnore = dormantStyleController,
) => {
  return styleControllerToIgnore.getUnderlyingValue(element, "backgroundColor");
};

// Register the style isolator custom element once
let persistentStyleIsolator = null;
const getNaviStyleIsolator = () => {
  if (persistentStyleIsolator) {
    return persistentStyleIsolator;
  }

  class StyleIsolator extends HTMLElement {
    constructor() {
      super();

      // Create shadow DOM to isolate from external CSS
      const shadow = this.attachShadow({ mode: "closed" });

      shadow.innerHTML = `
        <style>
          :host {
            all: initial;
            display: block;
            position: fixed;
            top: 0;
            left: 0;
            opacity: ${0};
            visibility: ${"hidden"};
            pointer-events: none;
          }
          * {
            all: revert;
          }
        </style>
        <div id="unstyled_element_slot"></div>
      `;

      this.unstyledElementSlot = shadow.querySelector("#unstyled_element_slot");
    }

    getIsolatedStyles(element, context = "js") {
      {
        this.unstyledElementSlot.innerHTML = "";
      }
      const unstyledElement = element.cloneNode(true);
      this.unstyledElementSlot.appendChild(unstyledElement);

      // Get computed styles of the actual element inside the shadow DOM
      const computedStyles = getComputedStyle(unstyledElement);
      // Create a copy of the styles since the original will be invalidated when element is removed
      const stylesCopy = {};
      for (let i = 0; i < computedStyles.length; i++) {
        const property = computedStyles[i];
        stylesCopy[property] = normalizeStyle(
          computedStyles.getPropertyValue(property),
          property,
          context,
        );
      }

      return stylesCopy;
    }
  }

  if (!customElements.get("navi-style-isolator")) {
    customElements.define("navi-style-isolator", StyleIsolator);
  }
  // Create and add the persistent element to the document
  persistentStyleIsolator = document.createElement("navi-style-isolator");
  document.body.appendChild(persistentStyleIsolator);
  return persistentStyleIsolator;
};

const stylesCache = new Map();
/**
 * Gets the default browser styles for an HTML element by creating an isolated custom element
 * @param {string|Element} input - CSS selector (e.g., 'input[type="text"]'), HTML source (e.g., '<button>'), or DOM element
 * @param {string} context - Output format: "js" for JS object (default) or "css" for CSS string
 * @returns {Object|string} Computed styles as JS object or CSS string
 */
const getDefaultStyles = (input, context = "js") => {
  let element;
  let cacheKey;

  // Determine input type and create element accordingly
  if (typeof input === "string") {
    if (input[0] === "<") {
      // HTML source
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = input;
      element = tempDiv.firstElementChild;
      if (!element) {
        throw new Error(`Invalid HTML source: ${input}`);
      }
      cacheKey = `${input}:${context}`;
    } else {
      // CSS selector
      element = createElementFromSelector(input);
      cacheKey = `${input}:${context}`;
    }
  } else if (input instanceof Element) {
    // DOM element
    element = input;
    cacheKey = `${input.outerHTML}:${context}`;
  } else {
    throw new Error(
      "Input must be a CSS selector, HTML source, or DOM element",
    );
  }

  // Check cache first
  if (stylesCache.has(cacheKey)) {
    return stylesCache.get(cacheKey);
  }

  // Get the persistent style isolator element
  const naviStyleIsolator = getNaviStyleIsolator();
  const defaultStyles = naviStyleIsolator.getIsolatedStyles(element, context);

  // Cache the result
  stylesCache.set(cacheKey, defaultStyles);

  return defaultStyles;
};

/**
 * Creates an HTML element from a CSS selector
 * @param {string} selector - CSS selector (e.g., 'input[type="text"]', 'button', 'a[href="#"]')
 * @returns {Element} DOM element
 */
const createElementFromSelector = (selector) => {
  // Parse the selector to extract tag name and attributes
  const tagMatch = selector.match(/^([a-zA-Z][a-zA-Z0-9-]*)/);
  if (!tagMatch) {
    throw new Error(`Invalid selector: ${selector}`);
  }

  const tagName = tagMatch[1].toLowerCase();
  const element = document.createElement(tagName);

  // Extract and apply attributes from selector
  const attributeRegex = /\[([^=\]]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/g;
  let attributeMatch;

  while ((attributeMatch = attributeRegex.exec(selector)) !== null) {
    const attrName = attributeMatch[1];
    const attrValue =
      attributeMatch[2] || attributeMatch[3] || attributeMatch[4] || "";
    element.setAttribute(attrName, attrValue);
  }

  return element;
};

const addAttributeEffect = (attributeName, effect) => {
  const cleanupWeakMap = new WeakMap();
  const applyEffect = (element) => {
    const cleanup = effect(element);
    cleanupWeakMap.set(
      element,
      typeof cleanup === "function" ? cleanup : () => {},
    );
  };

  const cleanupEffect = (element) => {
    const cleanup = cleanupWeakMap.get(element);
    if (cleanup) {
      cleanup();
      cleanupWeakMap.delete(element);
    }
  };

  const checkElement = (element) => {
    if (element.hasAttribute(attributeName)) {
      applyEffect(element);
    }
    const elementWithAttributeCollection = element.querySelectorAll(
      `[${attributeName}]`,
    );
    for (const elementWithAttribute of elementWithAttributeCollection) {
      applyEffect(elementWithAttribute);
    }
  };

  checkElement(document.body);
  const mutationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        for (const addedNode of mutation.addedNodes) {
          if (addedNode.nodeType !== Node.ELEMENT_NODE) {
            continue;
          }
          checkElement(addedNode);
        }

        for (const removedNode of mutation.removedNodes) {
          if (removedNode.nodeType !== Node.ELEMENT_NODE) {
            continue;
          }

          // Clean up the removed node itself if it had the attribute
          if (
            removedNode.hasAttribute &&
            removedNode.hasAttribute(attributeName)
          ) {
            cleanupEffect(removedNode);
          }

          // Clean up any children of the removed node that had the attribute
          if (removedNode.querySelectorAll) {
            const elementsWithAttribute = removedNode.querySelectorAll(
              `[${attributeName}]`,
            );
            for (const element of elementsWithAttribute) {
              cleanupEffect(element);
            }
          }
        }
      }
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === attributeName
      ) {
        const element = mutation.target;
        if (element.hasAttribute(attributeName)) {
          applyEffect(element);
        } else {
          cleanupEffect(element);
        }
      }
    }
  });
  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [attributeName],
  });

  return () => {
    mutationObserver.disconnect();
    for (const cleanup of cleanupWeakMap.values()) {
      cleanup();
    }
    cleanupWeakMap.clear();
  };
};

const setAttribute = (element, name, value) => {
  if (element.hasAttribute(name)) {
    const prevValue = element.getAttribute(name);
    element.setAttribute(name, value);
    return () => {
      element.setAttribute(name, prevValue);
    };
  }
  element.setAttribute(name, value);
  return () => {
    element.removeAttribute(name);
  };
};

const createSetMany = (setter) => {
  return (element, description) => {
    const cleanupCallbackSet = new Set();
    for (const name of Object.keys(description)) {
      const value = description[name];
      const restoreStyle = setter(element, name, value);
      cleanupCallbackSet.add(restoreStyle);
    }
    return () => {
      for (const cleanupCallback of cleanupCallbackSet) {
        cleanupCallback();
      }
      cleanupCallbackSet.clear();
    };
  };
};

const setAttributes = createSetMany(setAttribute);

/**
 * Chooses between light and dark colors based on which provides better contrast against a background
 * @param {string} backgroundColor - CSS color value (hex, rgb, hsl, CSS variable, etc.) to test against
 * @param {string} [lightColor="white"] - Light color option (typically for dark backgrounds)
 * @param {string} [darkColor="black"] - Dark color option (typically for light backgrounds)
 * @param {Element} [element] - DOM element to resolve CSS variables against
 * @returns {string} The color that provides better contrast (lightColor or darkColor)
 * @example
 * // Choose text color for a dark blue background
 * pickLightOrDark("#1a202c") // returns "white"
 *
 * // Choose text color for a light background with CSS variable
 * pickLightOrDark("var(--bg-color)", "white", "black", element) // returns "black" or "white"
 */


const pickLightOrDark = (
  backgroundColor,
  lightColor = "white",
  darkColor = "black",
  element,
) => {
  const resolvedBgColor = parseCSSColor(backgroundColor, element);
  const resolvedLightColor = parseCSSColor(lightColor, element);
  const resolvedDarkColor = parseCSSColor(darkColor, element);

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

/**
 * Resolves the luminance value of a CSS color
 * @param {string} color - CSS color value (hex, rgb, hsl, CSS variable, etc.)
 * @param {Element} [element] - DOM element to resolve CSS variables against
 * @returns {number|undefined} Relative luminance (0-1) according to WCAG formula, or undefined if color cannot be resolved
 * @example
 * // Get luminance of a hex color
 * resolveColorLuminance("#ff0000") // returns ~0.213 (red)
 *
 * // Get luminance of a CSS variable
 * resolveColorLuminance("var(--primary-color)", element) // returns luminance value or undefined
 *
 * // Use for light/dark classification
 * const luminance = resolveColorLuminance("#2ecc71");
 * const isLight = luminance > 0.3; // true for light colors, false for dark
 */
const resolveColorLuminance = (color, element) => {
  const rgba = parseCSSColor(color, element);
  if (!rgba) {
    return undefined;
  }
  const [r, g, b] = rgba;
  return getLuminance(r, g, b);
};

/**
 * Calculates the contrast ratio between two RGBA colors
 * Based on WCAG 2.1 specification
 * @param {Array<number>} rgba1 - [r, g, b, a] values for first color
 * @param {Array<number>} rgba2 - [r, g, b, a] values for second color
 * @param {Array<number>} [background=[255, 255, 255, 1]] - Background color to composite against when colors have transparency
 * @returns {number} Contrast ratio (1-21)
 */
const getContrastRatio = (
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
const getLuminance = (r, g, b) => {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

const findAncestor = (node, predicate) => {
  let ancestor = node.parentNode;
  while (ancestor) {
    if (predicate(ancestor)) {
      return ancestor;
    }
    ancestor = ancestor.parentNode;
  }
  return null;
};

const findDescendant = (rootNode, fn, { skipRoot } = {}) => {
  const iterator = createNextNodeIterator(rootNode, rootNode, skipRoot);
  let { done, value: node } = iterator.next();
  while (done === false) {
    let skipChildren = false;
    if (node === skipRoot) {
      skipChildren = true;
    } else {
      const skip = () => {
        skipChildren = true;
      };
      if (fn(node, skip)) {
        return node;
      }
    }
    ({ done, value: node } = iterator.next(skipChildren));
  }
  return null;
};

const findLastDescendant = (rootNode, fn, { skipRoot } = {}) => {
  const deepestNode = getDeepestNode(rootNode, skipRoot);
  if (deepestNode) {
    const iterator = createPreviousNodeIterator(
      deepestNode,
      rootNode,
      skipRoot,
    );
    let { done, value: node } = iterator.next();
    while (done === false) {
      if (fn(node)) {
        return node;
      }
      ({ done, value: node } = iterator.next());
    }
  }
  return null;
};

const findAfter = (
  from,
  predicate,
  { root = null, skipRoot = null, skipChildren = false } = {},
) => {
  const iterator = createAfterNodeIterator(from, root, skipChildren, skipRoot);
  let { done, value: node } = iterator.next();
  while (done === false) {
    if (predicate(node)) {
      return node;
    }
    ({ done, value: node } = iterator.next());
  }
  return null;
};

const findBefore = (
  from,
  predicate,
  { root = null, skipRoot = null } = {},
) => {
  const iterator = createPreviousNodeIterator(from, root, skipRoot);
  let { done, value: node } = iterator.next();
  while (done === false) {
    if (predicate(node)) {
      return node;
    }
    ({ done, value: node } = iterator.next());
  }
  return null;
};

const getNextNode = (node, rootNode, skipChild = false, skipRoot = null) => {
  if (!skipChild) {
    const firstChild = node.firstChild;
    if (firstChild) {
      // If the first child is skipRoot or inside skipRoot, skip it
      if (
        skipRoot &&
        (firstChild === skipRoot || skipRoot.contains(firstChild))
      ) {
        // Skip this entire subtree by going to next sibling or up
        return getNextNode(node, rootNode, true, skipRoot);
      }
      return firstChild;
    }
  }

  const nextSibling = node.nextSibling;
  if (nextSibling) {
    // If next sibling is skipRoot, skip it entirely
    if (skipRoot && nextSibling === skipRoot) {
      return getNextNode(nextSibling, rootNode, true, skipRoot);
    }
    return nextSibling;
  }

  const parentNode = node.parentNode;
  if (parentNode && parentNode !== rootNode) {
    return getNextNode(parentNode, rootNode, true, skipRoot);
  }

  return null;
};

const createNextNodeIterator = (node, rootNode, skipRoot = null) => {
  let current = node;
  const next = (innerSkipChildren = false) => {
    const nextNode = getNextNode(
      current,
      rootNode,
      innerSkipChildren,
      skipRoot,
    );
    current = nextNode;
    return {
      done: Boolean(nextNode) === false,
      value: nextNode,
    };
  };
  return { next };
};

const createAfterNodeIterator = (
  fromNode,
  rootNode,
  skipChildren = false,
  skipRoot = null,
) => {
  let current = fromNode;
  let childrenSkipped = false;

  // If we're inside skipRoot, we need to start searching after skipRoot entirely
  if (skipRoot && (fromNode === skipRoot || skipRoot.contains(fromNode))) {
    current = skipRoot;
    childrenSkipped = true; // Mark that we've already "processed" this node
    skipChildren = true; // Force skip children to exit the skipRoot subtree
  }

  const next = (innerSkipChildren = false) => {
    const nextNode = getNextNode(
      current,
      rootNode,
      (skipChildren && childrenSkipped === false) || innerSkipChildren,
      skipRoot,
    );
    childrenSkipped = true;
    current = nextNode;
    return {
      done: Boolean(nextNode) === false,
      value: nextNode,
    };
  };
  return { next };
};

const getDeepestNode = (node, skipRoot = null) => {
  let deepestNode = node.lastChild;
  while (deepestNode) {
    // If we hit skipRoot or enter its subtree, stop going deeper
    if (
      skipRoot &&
      (deepestNode === skipRoot || skipRoot.contains(deepestNode))
    ) {
      // Try the previous sibling instead
      const previousSibling = deepestNode.previousSibling;
      if (previousSibling) {
        return getDeepestNode(previousSibling, skipRoot);
      }
      // If no previous sibling, return the parent (which should be safe)
      return deepestNode.parentNode === node ? null : deepestNode.parentNode;
    }

    const lastChild = deepestNode.lastChild;
    if (lastChild) {
      deepestNode = lastChild;
    } else {
      break;
    }
  }
  return deepestNode;
};

const getPreviousNode = (node, rootNode, skipRoot = null) => {
  const previousSibling = node.previousSibling;
  if (previousSibling) {
    // If previous sibling is skipRoot, skip it entirely
    if (skipRoot && previousSibling === skipRoot) {
      return getPreviousNode(previousSibling, rootNode, skipRoot);
    }

    const deepestChild = getDeepestNode(previousSibling, skipRoot);

    // Check if deepest child is inside skipRoot (shouldn't happen with updated getDeepestNode, but safe check)
    if (
      skipRoot &&
      deepestChild &&
      (deepestChild === skipRoot || skipRoot.contains(deepestChild))
    ) {
      // Skip this sibling entirely and try the next one
      return getPreviousNode(previousSibling, rootNode, skipRoot);
    }

    if (deepestChild) {
      return deepestChild;
    }
    return previousSibling;
  }
  if (node !== rootNode) {
    const parentNode = node.parentNode;
    if (parentNode && parentNode !== rootNode) {
      return parentNode;
    }
  }
  return null;
};

const createPreviousNodeIterator = (fromNode, rootNode, skipRoot = null) => {
  let current = fromNode;

  // If we're inside skipRoot, we need to start searching before skipRoot entirely
  if (skipRoot && (fromNode === skipRoot || skipRoot.contains(fromNode))) {
    current = skipRoot;
  }

  const next = () => {
    const previousNode = getPreviousNode(current, rootNode, skipRoot);
    current = previousNode;
    return {
      done: Boolean(previousNode) === false,
      value: previousNode,
    };
  };
  return {
    next,
  };
};

const activeElementSignal = signal(document.activeElement);

document.addEventListener(
  "focus",
  () => {
    activeElementSignal.value = document.activeElement;
  },
  { capture: true },
);
// When clicking on document there is no "focus" event dispatched on the document
// We can detect that with "blur" event when relatedTarget is null
document.addEventListener(
  "blur",
  (e) => {
    if (!e.relatedTarget) {
      activeElementSignal.value = document.activeElement;
    }
  },
  { capture: true },
);

const useActiveElement = () => {
  return activeElementSignal.value;
};
const addActiveElementEffect = (callback) => {
  const remove = effect(() => {
    const activeElement = activeElementSignal.value;
    callback(activeElement);
  });
  return remove;
};

const elementIsVisibleForFocus = (node) => {
  return getFocusVisibilityInfo(node).visible;
};
const getFocusVisibilityInfo = (node) => {
  if (isDocumentElement(node)) {
    return { visible: true, reason: "is document" };
  }
  if (node.hasAttribute("hidden")) {
    return { visible: false, reason: "has hidden attribute" };
  }
  if (getStyle(node, "visibility") === "hidden") {
    return { visible: false, reason: "uses visiblity: hidden" };
  }
  if (node.tagName === "INPUT" && node.type === "hidden") {
    return { visible: false, reason: "input type hidden" };
  }
  let nodeOrAncestor = node;
  while (nodeOrAncestor) {
    if (isDocumentElement(nodeOrAncestor)) {
      break;
    }
    if (getStyle(nodeOrAncestor, "display") === "none") {
      return { visible: false, reason: "ancestor uses display: none" };
    }
    // Check if element is inside a closed details element
    if (elementIsDetails(nodeOrAncestor) && !nodeOrAncestor.open) {
      // Special case: summary elements are visible even when their parent details is closed
      // But only if this details element is the direct parent of the summary
      if (!elementIsSummary(node) || node.parentElement !== nodeOrAncestor) {
        return { visible: false, reason: "inside closed details element" };
      }
      // Continue checking ancestors
    }
    nodeOrAncestor = nodeOrAncestor.parentNode;
  }
  return { visible: true, reason: "no reason to be hidden" };
};

const elementIsVisuallyVisible = (node, options = {}) => {
  return getVisuallyVisibleInfo(node, options).visible;
};
const getVisuallyVisibleInfo = (
  node,
  { countOffscreenAsVisible = false } = {},
) => {
  // First check all the focusable visibility conditions
  const focusVisibilityInfo = getFocusVisibilityInfo(node);
  if (!focusVisibilityInfo.visible) {
    return focusVisibilityInfo;
  }

  // Additional visual visibility checks
  if (getStyle(node, "opacity") === "0") {
    return { visible: false, reason: "uses opacity: 0" };
  }

  const rect = node.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return { visible: false, reason: "has zero dimensions" };
  }

  // Check for clipping
  const clipStyle = getStyle(node, "clip");
  if (clipStyle && clipStyle !== "auto" && clipStyle.includes("rect(0")) {
    return { visible: false, reason: "clipped with clip property" };
  }

  const clipPathStyle = getStyle(node, "clip-path");
  if (clipPathStyle && clipPathStyle.includes("inset(100%")) {
    return { visible: false, reason: "clipped with clip-path" };
  }

  // Check if positioned off-screen (unless option says to count as visible)
  if (!countOffscreenAsVisible) {
    if (
      rect.right < 0 ||
      rect.bottom < 0 ||
      rect.left > window.innerWidth ||
      rect.top > window.innerHeight
    ) {
      return { visible: false, reason: "positioned off-screen" };
    }
  }

  // Check for transform scale(0)
  const transformStyle = getStyle(node, "transform");
  if (transformStyle && transformStyle.includes("scale(0")) {
    return { visible: false, reason: "scaled to zero with transform" };
  }

  return { visible: true, reason: "visually visible" };
};
const getFirstVisuallyVisibleAncestor = (node, options = {}) => {
  let ancestorCandidate = node.parentNode;
  while (ancestorCandidate) {
    const visibilityInfo = getVisuallyVisibleInfo(ancestorCandidate, options);
    if (visibilityInfo.visible) {
      return ancestorCandidate;
    }
    ancestorCandidate = ancestorCandidate.parentElement;
  }
  // This shouldn't happen in normal cases since document element is always visible
  return null;
};

const elementIsFocusable = (node) => {
  // only element node can be focused, document, textNodes etc cannot
  if (node.nodeType !== 1) {
    return false;
  }
  if (!canInteract(node)) {
    return false;
  }
  const nodeName = node.nodeName.toLowerCase();
  if (nodeName === "input") {
    if (node.type === "hidden") {
      return false;
    }
    return elementIsVisibleForFocus(node);
  }
  if (
    ["button", "select", "datalist", "iframe", "textarea"].indexOf(nodeName) >
    -1
  ) {
    return elementIsVisibleForFocus(node);
  }
  if (["a", "area"].indexOf(nodeName) > -1) {
    if (node.hasAttribute("href") === false) {
      return false;
    }
    return elementIsVisibleForFocus(node);
  }
  if (["audio", "video"].indexOf(nodeName) > -1) {
    if (node.hasAttribute("controls") === false) {
      return false;
    }
    return elementIsVisibleForFocus(node);
  }
  if (nodeName === "summary") {
    return elementIsVisibleForFocus(node);
  }
  if (node.hasAttribute("tabindex") || node.hasAttribute("tabIndex")) {
    return elementIsVisibleForFocus(node);
  }
  if (node.hasAttribute("draggable")) {
    return elementIsVisibleForFocus(node);
  }
  return false;
};

const canInteract = (element) => {
  if (element.disabled) {
    return false;
  }
  if (element.hasAttribute("inert")) {
    // https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert
    return false;
  }
  return true;
};

const findFocusable = (element) => {
  const associatedElements = getAssociatedElements(element);
  if (associatedElements) {
    for (const associatedElement of associatedElements) {
      const focusable = findFocusable(associatedElement);
      if (focusable) {
        return focusable;
      }
    }
    return null;
  }
  if (elementIsFocusable(element)) {
    return element;
  }
  const focusableDescendant = findDescendant(element, elementIsFocusable);
  return focusableDescendant;
};

const canInterceptKeys = (event) => {
  const target = event.target;
  // Don't handle shortcuts when user is typing
  if (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.contentEditable === "true" ||
    target.isContentEditable
  ) {
    return false;
  }
  // Don't handle shortcuts when select dropdown is open
  if (target.tagName === "SELECT") {
    return false;
  }
  // Don't handle shortcuts when target or container is disabled
  if (
    target.disabled ||
    target.closest("[disabled]") ||
    target.inert ||
    target.closest("[inert]")
  ) {
    return false;
  }
  return true;
};

// WeakMap to store focus group metadata
const focusGroupRegistry = new WeakMap();

const setFocusGroup = (element, options) => {
  focusGroupRegistry.set(element, options);
  return () => {
    focusGroupRegistry.delete(element);
  };
};
const getFocusGroup = (element) => {
  return focusGroupRegistry.get(element);
};

const createEventMarker = (symbolName) => {
  const symbol = Symbol.for(symbolName);

  const isMarked = (event) => {
    return Boolean(event[symbol]);
  };

  return {
    mark: (event) => {
      event[symbol] = true;
    },
    isMarked,
  };
};

const focusNavEventMarker = createEventMarker("focus_nav");

const preventFocusNav = (event) => {
  focusNavEventMarker.mark(event);
};

const isFocusNavMarked = (event) => {
  return focusNavEventMarker.isMarked(event);
};
const markFocusNav = (event) => {
  focusNavEventMarker.mark(event);
};

const performArrowNavigation = (
  event,
  element,
  { direction = "both", loop, name } = {},
) => {
  if (!canInterceptKeys(event)) {
    return false;
  }
  const activeElement = document.activeElement;
  if (activeElement.hasAttribute("data-focusnav") === "none") {
    // no need to prevent default here (arrow don't move focus by default in a focus group)
    // (and it would prevent scroll via keyboard that we might want here)
    return true;
  }

  const onTargetToFocus = (targetToFocus) => {
    console.debug(
      `Arrow navigation: ${event.key} from`,
      activeElement,
      "to",
      targetToFocus,
    );
    event.preventDefault();
    markFocusNav(event);
    targetToFocus.focus();
  };

  // Grid navigation: we support only TABLE element for now
  // A role="table" or an element with display: table could be used too but for now we need only TABLE support
  if (element.tagName === "TABLE") {
    const targetInGrid = getTargetInTableFocusGroup(event, element, { loop });
    if (!targetInGrid) {
      return false;
    }
    onTargetToFocus(targetInGrid);
    return true;
  }

  const targetInLinearGroup = getTargetInLinearFocusGroup(event, element, {
    direction,
    loop,
    name,
  });
  if (!targetInLinearGroup) {
    return false;
  }
  onTargetToFocus(targetInLinearGroup);
  return true;
};

const getTargetInLinearFocusGroup = (
  event,
  element,
  { direction, loop, name },
) => {
  const activeElement = document.activeElement;

  // Check for Cmd/Ctrl + arrow keys for jumping to start/end of linear group
  const isJumpToEnd = event.metaKey || event.ctrlKey;

  if (isJumpToEnd) {
    return getJumpToEndTargetLinear(event, element, direction);
  }

  const isForward = isForwardArrow(event, direction);

  // Arrow Left/Up: move to previous focusable element in group
  backward: {
    if (!isBackwardArrow(event, direction)) {
      break backward;
    }
    const previousElement = findBefore(activeElement, elementIsFocusable, {
      root: element,
    });
    if (previousElement) {
      return previousElement;
    }
    const ancestorTarget = delegateArrowNavigation(event, element, {
      name,
    });
    if (ancestorTarget) {
      return ancestorTarget;
    }
    if (loop) {
      const lastFocusableElement = findLastDescendant(
        element,
        elementIsFocusable,
      );
      if (lastFocusableElement) {
        return lastFocusableElement;
      }
    }
    return null;
  }

  // Arrow Right/Down: move to next focusable element in group
  forward: {
    if (!isForward) {
      break forward;
    }
    const nextElement = findAfter(activeElement, elementIsFocusable, {
      root: element,
    });
    if (nextElement) {
      return nextElement;
    }
    const ancestorTarget = delegateArrowNavigation(event, element, {
      name,
    });
    if (ancestorTarget) {
      return ancestorTarget;
    }
    if (loop) {
      // No next element, wrap to first focusable in group
      const firstFocusableElement = findDescendant(element, elementIsFocusable);
      if (firstFocusableElement) {
        return firstFocusableElement;
      }
    }
    return null;
  }

  return null;
};
// Find parent focus group with the same name and try delegation
const delegateArrowNavigation = (event, currentElement, { name }) => {
  let ancestorElement = currentElement.parentElement;
  while (ancestorElement) {
    const ancestorFocusGroup = getFocusGroup(ancestorElement);
    if (!ancestorFocusGroup) {
      ancestorElement = ancestorElement.parentElement;
      continue;
    }

    // Check if groups should delegate to each other
    const shouldDelegate =
      name === undefined && ancestorFocusGroup.name === undefined
        ? true // Both unnamed - delegate based on ancestor relationship
        : ancestorFocusGroup.name === name; // Both have same explicit name

    if (shouldDelegate) {
      // Try navigation in parent focus group
      return getTargetInLinearFocusGroup(event, ancestorElement, {
        direction: ancestorFocusGroup.direction,
        loop: ancestorFocusGroup.loop,
        name: ancestorFocusGroup.name,
      });
    }
  }
  return null;
};

// Handle Cmd/Ctrl + arrow keys for linear focus groups to jump to start/end
const getJumpToEndTargetLinear = (event, element, direction) => {
  // Check if this arrow key is valid for the given direction
  if (!isForwardArrow(event, direction) && !isBackwardArrow(event, direction)) {
    return null;
  }

  if (isBackwardArrow(event, direction)) {
    // Jump to first focusable element in the group
    return findDescendant(element, elementIsFocusable);
  }

  if (isForwardArrow(event, direction)) {
    // Jump to last focusable element in the group
    return findLastDescendant(element, elementIsFocusable);
  }

  return null;
};

const isBackwardArrow = (event, direction = "both") => {
  const backwardKeys = {
    both: ["ArrowLeft", "ArrowUp"],
    vertical: ["ArrowUp"],
    horizontal: ["ArrowLeft"],
  };
  return backwardKeys[direction]?.includes(event.key) ?? false;
};
const isForwardArrow = (event, direction = "both") => {
  const forwardKeys = {
    both: ["ArrowRight", "ArrowDown"],
    vertical: ["ArrowDown"],
    horizontal: ["ArrowRight"],
  };
  return forwardKeys[direction]?.includes(event.key) ?? false;
};

// Handle arrow navigation inside an HTMLTableElement as a grid.
// Moves focus to adjacent cell in the direction of the arrow key.
const getTargetInTableFocusGroup = (event, table, { loop }) => {
  const arrowKey = event.key;

  // Only handle arrow keys
  if (
    arrowKey !== "ArrowRight" &&
    arrowKey !== "ArrowLeft" &&
    arrowKey !== "ArrowUp" &&
    arrowKey !== "ArrowDown"
  ) {
    return null;
  }

  const focusedElement = document.activeElement;
  const currentCell = focusedElement?.closest?.("td,th");

  // If we're not currently in a table cell, try to focus the first focusable element in the table
  if (!currentCell || !table.contains(currentCell)) {
    return findDescendant(table, elementIsFocusable) || null;
  }

  // Get the current position in the table grid
  const currentRow = currentCell.parentElement; // tr element
  const allRows = Array.from(table.rows);
  const currentRowIndex = /** @type {HTMLTableRowElement} */ (currentRow)
    .rowIndex;
  const currentColumnIndex = /** @type {HTMLTableCellElement} */ (currentCell)
    .cellIndex;

  // Check for Cmd/Ctrl + arrow keys for jumping to end of row/column
  const isJumpToEnd = event.metaKey || event.ctrlKey;

  if (isJumpToEnd) {
    return getJumpToEndTarget(
      arrowKey,
      allRows,
      currentRowIndex,
      currentColumnIndex,
    );
  }

  // Create an iterator that will scan through cells in the arrow direction
  // until it finds one with a focusable element inside
  const candidateCells = createTableCellIterator(arrowKey, allRows, {
    startRow: currentRowIndex,
    startColumn: currentColumnIndex,
    originalColumn: currentColumnIndex, // Used to maintain column alignment for vertical moves
    loopMode: normalizeLoop(loop),
  });

  // Find the first cell that is itself focusable
  for (const candidateCell of candidateCells) {
    if (elementIsFocusable(candidateCell)) {
      return candidateCell;
    }
  }

  return null; // No focusable cell found
};

// Handle Cmd/Ctrl + arrow keys to jump to the end of row/column
const getJumpToEndTarget = (
  arrowKey,
  allRows,
  currentRowIndex,
  currentColumnIndex,
) => {
  if (arrowKey === "ArrowRight") {
    // Jump to last focusable cell in current row
    const currentRow = allRows[currentRowIndex];
    if (!currentRow) return null;

    // Start from the last cell and work backwards to find focusable
    const cells = Array.from(currentRow.cells);
    for (let i = cells.length - 1; i >= 0; i--) {
      const cell = cells[i];
      if (elementIsFocusable(cell)) {
        return cell;
      }
    }
    return null;
  }

  if (arrowKey === "ArrowLeft") {
    // Jump to first focusable cell in current row
    const currentRow = allRows[currentRowIndex];
    if (!currentRow) return null;

    const cells = Array.from(currentRow.cells);
    for (const cell of cells) {
      if (elementIsFocusable(cell)) {
        return cell;
      }
    }
    return null;
  }

  if (arrowKey === "ArrowDown") {
    // Jump to last focusable cell in current column
    for (let rowIndex = allRows.length - 1; rowIndex >= 0; rowIndex--) {
      const row = allRows[rowIndex];
      const cell = row?.cells?.[currentColumnIndex];
      if (cell && elementIsFocusable(cell)) {
        return cell;
      }
    }
    return null;
  }

  if (arrowKey === "ArrowUp") {
    // Jump to first focusable cell in current column
    for (let rowIndex = 0; rowIndex < allRows.length; rowIndex++) {
      const row = allRows[rowIndex];
      const cell = row?.cells?.[currentColumnIndex];
      if (cell && elementIsFocusable(cell)) {
        return cell;
      }
    }
    return null;
  }

  return null;
};

// Create an iterator that yields table cells in the direction of arrow key movement.
// This scans through cells until it finds one with a focusable element or completes a full loop.
const createTableCellIterator = function* (
  arrowKey,
  allRows,
  { startRow, startColumn, originalColumn, loopMode },
) {
  if (allRows.length === 0) {
    return; // No rows to navigate
  }

  // Keep track of which column we should prefer for vertical movements
  // This helps maintain column alignment when moving up/down through rows of different lengths
  let preferredColumn = originalColumn;

  const normalizedLoopMode = normalizeLoop(loopMode);

  // Helper function to calculate the next position based on current position and arrow key
  const calculateNextPosition = (currentRow, currentColumn) =>
    getNextTablePosition(
      arrowKey,
      allRows,
      currentRow,
      currentColumn,
      preferredColumn,
      normalizedLoopMode,
    );

  // Start by calculating the first position to move to
  let nextPosition = calculateNextPosition(startRow, startColumn);
  if (!nextPosition) {
    return; // Cannot move in this direction (no looping enabled)
  }

  // Keep track of our actual starting position to detect when we've completed a full loop
  const actualStartingPosition = `${startRow}:${startColumn}`;

  while (true) {
    const [nextColumn, nextRow] = nextPosition; // Destructure [column, row]
    const targetRow = allRows[nextRow];
    const targetCell = targetRow?.cells?.[nextColumn];

    // Yield the cell if it exists
    if (targetCell) {
      yield targetCell;
    }

    // Update our preferred column based on movement:
    // - For horizontal moves, update to current column
    // - For vertical moves in flow mode at boundaries, advance to next/previous column
    if (arrowKey === "ArrowRight" || arrowKey === "ArrowLeft") {
      preferredColumn = nextColumn;
    } else if (arrowKey === "ArrowDown") {
      const isAtBottomRow = nextRow === allRows.length - 1;
      if (isAtBottomRow && normalizedLoopMode === "flow") {
        // Moving down from bottom row in flow mode: advance to next column
        const maxColumns = getMaxColumns(allRows);
        preferredColumn = preferredColumn + 1;
        if (preferredColumn >= maxColumns) {
          preferredColumn = 0; // Wrap to first column
        }
      }
    } else if (arrowKey === "ArrowUp") {
      const isAtTopRow = nextRow === 0;
      if (isAtTopRow && normalizedLoopMode === "flow") {
        // Moving up from top row in flow mode: go to previous column
        const maxColumns = getMaxColumns(allRows);
        if (preferredColumn === 0) {
          preferredColumn = maxColumns - 1; // Wrap to last column
        } else {
          preferredColumn = preferredColumn - 1;
        }
      }
    }

    // Calculate where to move next
    nextPosition = calculateNextPosition(nextRow, nextColumn);
    if (!nextPosition) {
      return; // Hit a boundary with no looping
    }

    // Check if we've completed a full loop by returning to our actual starting position
    const currentPositionKey = `${nextRow}:${nextColumn}`;
    if (currentPositionKey === actualStartingPosition) {
      return; // We've gone full circle back to where we started
    }
  }
};

// Normalize loop option to a mode string or false
const normalizeLoop = (loop) => {
  if (loop === true) return "wrap";
  if (loop === "wrap") return "wrap";
  if (loop === "flow") return "flow";
  return false;
};

const getMaxColumns = (rows) =>
  rows.reduce((max, r) => Math.max(max, r?.cells?.length || 0), 0);

// Calculate the next row and column position when moving in a table with arrow keys.
// Returns [column, row] for the next position, or null if movement is not possible.
const getNextTablePosition = (
  arrowKey,
  allRows,
  currentRow,
  currentColumn,
  preferredColumn, // Used for vertical movement to maintain column alignment
  loopMode,
) => {
  if (arrowKey === "ArrowRight") {
    const currentRowLength = allRows[currentRow]?.cells?.length || 0;
    const nextColumn = currentColumn + 1;

    // Can we move right within the same row?
    if (nextColumn < currentRowLength) {
      return [nextColumn, currentRow]; // [column, row]
    }

    // We're at the end of the row - handle boundary behavior
    if (loopMode === "flow") {
      // Flow mode: move to first cell of next row (wrap to top if at bottom)
      let nextRow = currentRow + 1;
      if (nextRow >= allRows.length) {
        nextRow = 0; // Wrap to first row
      }
      return [0, nextRow]; // [column, row]
    }

    if (loopMode === "wrap") {
      // Wrap mode: stay in same row, wrap to first column
      return [0, currentRow]; // [column, row]
    }

    // No looping: can't move
    return null;
  }

  if (arrowKey === "ArrowLeft") {
    const previousColumn = currentColumn - 1;

    // Can we move left within the same row?
    if (previousColumn >= 0) {
      return [previousColumn, currentRow]; // [column, row]
    }

    // We're at the beginning of the row - handle boundary behavior
    if (loopMode === "flow") {
      // Flow mode: move to last cell of previous row (wrap to bottom if at top)
      let previousRow = currentRow - 1;
      if (previousRow < 0) {
        previousRow = allRows.length - 1; // Wrap to last row
      }
      const previousRowLength = allRows[previousRow]?.cells?.length || 0;
      const lastColumnInPreviousRow = Math.max(0, previousRowLength - 1);
      return [lastColumnInPreviousRow, previousRow]; // [column, row]
    }

    if (loopMode === "wrap") {
      // Wrap mode: stay in same row, wrap to last column
      const currentRowLength = allRows[currentRow]?.cells?.length || 0;
      const lastColumnInCurrentRow = Math.max(0, currentRowLength - 1);
      return [lastColumnInCurrentRow, currentRow]; // [column, row]
    }

    // No looping: can't move
    return null;
  }

  if (arrowKey === "ArrowDown") {
    const nextRow = currentRow + 1;

    // Can we move down within the table?
    if (nextRow < allRows.length) {
      const nextRowLength = allRows[nextRow]?.cells?.length || 0;
      // Try to maintain the preferred column, but clamp to row length
      const targetColumn = Math.min(
        preferredColumn,
        Math.max(0, nextRowLength - 1),
      );
      return [targetColumn, nextRow]; // [column, row]
    }

    // We're at the bottom row - handle boundary behavior
    if (loopMode === "flow") {
      // Flow mode: advance to next column and go to top row
      const maxColumns = Math.max(1, getMaxColumns(allRows));
      let nextColumnInFlow = currentColumn + 1;
      if (nextColumnInFlow >= maxColumns) {
        nextColumnInFlow = 0; // Wrap to first column
      }
      const topRowLength = allRows[0]?.cells?.length || 0;
      const clampedColumn = Math.min(
        nextColumnInFlow,
        Math.max(0, topRowLength - 1),
      );
      return [clampedColumn, 0]; // [column, row]
    }

    if (loopMode === "wrap") {
      // Wrap mode: go to top row, maintaining preferred column
      const topRowLength = allRows[0]?.cells?.length || 0;
      const targetColumn = Math.min(
        preferredColumn,
        Math.max(0, topRowLength - 1),
      );
      return [targetColumn, 0]; // [column, row]
    }

    // No looping: can't move
    return null;
  }

  if (arrowKey === "ArrowUp") {
    const previousRow = currentRow - 1;

    // Can we move up within the table?
    if (previousRow >= 0) {
      const previousRowLength = allRows[previousRow]?.cells?.length || 0;
      // Try to maintain the preferred column, but clamp to row length
      const targetColumn = Math.min(
        preferredColumn,
        Math.max(0, previousRowLength - 1),
      );
      return [targetColumn, previousRow]; // [column, row]
    }

    // We're at the top row - handle boundary behavior
    if (loopMode === "flow") {
      // Flow mode: go to previous column and move to bottom row
      const maxColumns = Math.max(1, getMaxColumns(allRows));
      let previousColumnInFlow;
      if (currentColumn === 0) {
        previousColumnInFlow = maxColumns - 1; // Wrap to last column
      } else {
        previousColumnInFlow = currentColumn - 1;
      }
      const bottomRowIndex = allRows.length - 1;
      const bottomRowLength = allRows[bottomRowIndex]?.cells?.length || 0;
      const clampedColumn = Math.min(
        previousColumnInFlow,
        Math.max(0, bottomRowLength - 1),
      );
      return [clampedColumn, bottomRowIndex]; // [column, row]
    }

    if (loopMode === "wrap") {
      // Wrap mode: go to bottom row, maintaining preferred column
      const bottomRowIndex = allRows.length - 1;
      const bottomRowLength = allRows[bottomRowIndex]?.cells?.length || 0;
      const targetColumn = Math.min(
        preferredColumn,
        Math.max(0, bottomRowLength - 1),
      );
      return [targetColumn, bottomRowIndex]; // [column, row]
    }

    // No looping: can't move
    return null;
  }

  // Unknown arrow key
  return null;
};

const performTabNavigation = (
  event,
  { rootElement = document.body, outsideOfElement = null } = {},
) => {
  if (!isTabEvent$1(event)) {
    return false;
  }
  const activeElement = document.activeElement;
  if (activeElement.getAttribute("data-focusnav") === "none") {
    event.preventDefault(); // ensure tab cannot move focus
    return true;
  }
  const isForward = !event.shiftKey;
  const onTargetToFocus = (targetToFocus) => {
    console.debug(
      `Tab navigation: ${isForward ? "forward" : "backward"} from`,
      activeElement,
      "to",
      targetToFocus,
    );
    event.preventDefault();
    markFocusNav(event);
    targetToFocus.focus();
  };

  {
    console.debug(
      `Tab navigation: ${isForward ? "forward" : "backward"} from,`,
      activeElement,
    );
  }

  const predicate = (candidate) => {
    const canBeFocusedByTab = isFocusableByTab(candidate);
    {
      console.debug(`Testing`, candidate, `${canBeFocusedByTab ? "✓" : "✗"}`);
    }
    return canBeFocusedByTab;
  };

  const activeElementIsRoot = activeElement === rootElement;
  forward: {
    if (!isForward) {
      break forward;
    }
    if (activeElementIsRoot) {
      const firstFocusableElement = findDescendant(activeElement, predicate, {
        skipRoot: outsideOfElement,
      });
      if (firstFocusableElement) {
        return onTargetToFocus(firstFocusableElement);
      }
      return false;
    }
    const nextFocusableElement = findAfter(activeElement, predicate, {
      root: rootElement,
      skipRoot: outsideOfElement,
    });
    if (nextFocusableElement) {
      return onTargetToFocus(nextFocusableElement);
    }
    const firstFocusableElement = findDescendant(activeElement, predicate, {
      skipRoot: outsideOfElement,
    });
    if (firstFocusableElement) {
      return onTargetToFocus(firstFocusableElement);
    }
    return false;
  }

  {
    if (activeElementIsRoot) {
      const lastFocusableElement = findLastDescendant(
        activeElement,
        predicate,
        {
          skipRoot: outsideOfElement,
        },
      );
      if (lastFocusableElement) {
        return onTargetToFocus(lastFocusableElement);
      }
      return false;
    }

    const previousFocusableElement = findBefore(activeElement, predicate, {
      root: rootElement,
      skipRoot: outsideOfElement,
    });
    if (previousFocusableElement) {
      return onTargetToFocus(previousFocusableElement);
    }
    const lastFocusableElement = findLastDescendant(activeElement, predicate, {
      skipRoot: outsideOfElement,
    });
    if (lastFocusableElement) {
      return onTargetToFocus(lastFocusableElement);
    }
    return false;
  }
};

const isTabEvent$1 = (event) => event.key === "Tab" || event.keyCode === 9;

const isFocusableByTab = (element) => {
  if (hasNegativeTabIndex(element)) {
    return false;
  }
  return elementIsFocusable(element);
};
const hasNegativeTabIndex = (element) => {
  return (
    element.hasAttribute &&
    element.hasAttribute("tabIndex") &&
    Number(element.getAttribute("tabindex")) < 0
  );
};

/**
 * 
- https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/Focusgroup/explainer.md
 - https://open-ui.org/components/focusgroup.explainer/
 - https://github.com/openui/open-ui/issues/990

 - https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/Focusgroup/explainer.md#69-grid-focusgroups
 */


const initFocusGroup = (
  element,
  {
    direction = "both",
    // extend = true,
    skipTab = true,
    loop = false,
    name, // Can be undefined for implicit ancestor-descendant grouping
  } = {},
) => {
  const cleanupCallbackSet = new Set();
  const cleanup = () => {
    for (const callback of cleanupCallbackSet) {
      callback();
    }
    cleanupCallbackSet.clear();
  };

  // Store focus group data in registry
  const removeFocusGroup = setFocusGroup(element, {
    direction,
    loop,
    name, // Store undefined as-is for implicit grouping
  });
  cleanupCallbackSet.add(removeFocusGroup);

  tab: {
    if (!skipTab) {
      break tab;
    }
    const handleTabKeyDown = (event) => {
      if (isFocusNavMarked(event)) {
        // Prevent double handling of the same event + allow preventing focus nav from outside
        return;
      }
      performTabNavigation(event, { outsideOfElement: element });
    };
    // Handle Tab navigation (exit group)
    element.addEventListener("keydown", handleTabKeyDown, {
      // we must use capture: false to let chance for other part of the code
      // to call preventFocusNav
      capture: false,
      passive: false,
    });
    cleanupCallbackSet.add(() => {
      element.removeEventListener("keydown", handleTabKeyDown, {
        capture: false,
        passive: false,
      });
    });
  }

  // Handle Arrow key navigation (within group)
  {
    const handleArrowKeyDown = (event) => {
      if (isFocusNavMarked(event)) {
        // Prevent double handling of the same event + allow preventing focus nav from outside
        return;
      }
      performArrowNavigation(event, element, { direction, loop, name });
    };
    element.addEventListener("keydown", handleArrowKeyDown, {
      // we must use capture: false to let chance for other part of the code
      // to call preventFocusNav
      capture: false,
      passive: false,
    });
    cleanupCallbackSet.add(() => {
      element.removeEventListener("keydown", handleArrowKeyDown, {
        capture: false,
        passive: false,
      });
    });
  }

  return { cleanup };
};

const preventFocusNavViaKeyboard = (keyboardEvent) => {
  if (keyboardEvent.key === "Tab") {
    // prevent tab to move focus
    keyboardEvent.preventDefault();
    return true;
  }
  // ensure we won't perform our internal focus nav in focus groups
  preventFocusNav(keyboardEvent);
  return false;
};

const trapFocusInside = (element) => {
  if (element.nodeType === 3) {
    console.warn("cannot trap focus inside a text node");
    return () => {};
  }

  const trappedElement = activeTraps.find(
    (activeTrap) => activeTrap.element === element,
  );
  if (trappedElement) {
    console.warn("focus already trapped inside this element");
    return () => {};
  }

  const isEventOutside = (event) => {
    if (event.target === element) return false;
    if (element.contains(event.target)) return false;
    return true;
  };

  const lock = () => {
    const onmousedown = (event) => {
      if (isEventOutside(event)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    const onkeydown = (event) => {
      if (isTabEvent(event)) {
        performTabNavigation(event, { rootElement: element });
      }
    };

    document.addEventListener("mousedown", onmousedown, {
      capture: true,
      passive: false,
    });
    document.addEventListener("keydown", onkeydown, {
      capture: true,
      passive: false,
    });

    return () => {
      document.removeEventListener("mousedown", onmousedown, {
        capture: true,
        passive: false,
      });
      document.removeEventListener("keydown", onkeydown, {
        capture: true,
        passive: false,
      });
    };
  };

  const deactivate = activate({
    // element
    lock,
  });

  const untrap = () => {
    deactivate();
  };

  return untrap;
};

const isTabEvent = (event) => event.key === "Tab" || event.keyCode === 9;

const activeTraps = [];
const activate = ({ lock }) => {
  // unlock any trap currently activated
  let previousTrap;
  if (activeTraps.length > 0) {
    previousTrap = activeTraps[activeTraps.length - 1];
    previousTrap.unlock();
  }

  // store trap methods to lock/unlock as traps are acivated/deactivated
  const trap = { lock, unlock: lock() };
  activeTraps.push(trap);

  return () => {
    if (activeTraps.length === 0) {
      console.warn("cannot deactivate an already deactivated trap");
      return;
    }
    const lastTrap = activeTraps[activeTraps.length - 1];
    if (trap !== lastTrap) {
      // TODO: investigate this and maybe remove this requirment
      console.warn(
        "you must deactivate trap in the same order they were activated",
      );
      return;
    }
    activeTraps.pop();
    trap.unlock();
    // if any,reactivate the previous trap
    if (previousTrap) {
      previousTrap.unlock = previousTrap.lock();
    }
  };
};

// Helper to create scroll state capture/restore function for an element
const captureScrollState = (element) => {
  const scrollLeft = element.scrollLeft;
  const scrollTop = element.scrollTop;
  const scrollWidth = element.scrollWidth;
  const scrollHeight = element.scrollHeight;
  const clientWidth = element.clientWidth;
  const clientHeight = element.clientHeight;

  // Calculate scroll percentages to preserve relative position
  const scrollLeftPercent =
    scrollWidth > clientWidth ? scrollLeft / (scrollWidth - clientWidth) : 0;
  const scrollTopPercent =
    scrollHeight > clientHeight ? scrollTop / (scrollHeight - clientHeight) : 0;

  // Return preserve function that maintains scroll position relative to content
  return () => {
    // Get current dimensions after DOM changes
    const newScrollWidth = element.scrollWidth;
    const newScrollHeight = element.scrollHeight;
    const newClientWidth = element.clientWidth;
    const newClientHeight = element.clientHeight;

    // If content dimensions changed significantly, use percentage-based positioning
    if (
      Math.abs(newScrollWidth - scrollWidth) > 1 ||
      Math.abs(newScrollHeight - scrollHeight) > 1 ||
      Math.abs(newClientWidth - clientWidth) > 1 ||
      Math.abs(newClientHeight - clientHeight) > 1
    ) {
      if (newScrollWidth > newClientWidth) {
        const newScrollLeft =
          scrollLeftPercent * (newScrollWidth - newClientWidth);
        element.scrollLeft = newScrollLeft;
      }

      if (newScrollHeight > newClientHeight) {
        const newScrollTop =
          scrollTopPercent * (newScrollHeight - newClientHeight);
        element.scrollTop = newScrollTop;
      }
    } else {
      element.scrollLeft = scrollLeft;
      element.scrollTop = scrollTop;
    }
  };
};

// note: keep in mind that an element with overflow: 'hidden' is scrollable
// it can be scrolled using keyboard arrows or JavaScript properties such as scrollTop, scrollLeft
// the only overflow that prevents scroll is "visible"
const isScrollable = (element, { includeHidden } = {}) => {
  if (canHaveVerticalScroll(element, { includeHidden })) {
    return true;
  }
  if (canHaveHorizontalScroll(element, { includeHidden })) {
    return true;
  }
  return false;
};

const canHaveVerticalScroll = (element, { includeHidden }) => {
  const verticalOverflow = getStyle(element, "overflow-y");
  if (verticalOverflow === "visible") {
    // browser returns "visible" on documentElement even if it is scrollable
    if (isDocumentElement(element)) {
      return true;
    }
    return false;
  }
  if (verticalOverflow === "hidden" || verticalOverflow === "clip") {
    return includeHidden;
  }
  const overflow = getStyle(element, "overflow");
  if (overflow === "visible") {
    // browser returns "visible" on documentElement even if it is scrollable
    if (isDocumentElement(element)) {
      return true;
    }
    return false;
  }
  if (overflow === "hidden" || overflow === "clip") {
    return includeHidden;
  }
  return true; // "auto", "scroll"
};
const canHaveHorizontalScroll = (element, { includeHidden }) => {
  const horizontalOverflow = getStyle(element, "overflow-x");
  if (horizontalOverflow === "visible") {
    // browser returns "visible" on documentElement even if it is scrollable
    if (isDocumentElement(element)) {
      return true;
    }
    return false;
  }
  if (horizontalOverflow === "hidden" || horizontalOverflow === "clip") {
    return includeHidden;
  }
  const overflow = getStyle(element, "overflow");
  if (overflow === "visible") {
    if (isDocumentElement(element)) {
      // browser returns "visible" on documentElement even if it is scrollable
      return true;
    }
    return false;
  }
  if (overflow === "hidden" || overflow === "clip") {
    return includeHidden;
  }
  return true; // "auto", "scroll"
};

const getScrollingElement = (document) => {
  const { scrollingElement } = document;
  if (scrollingElement) {
    return scrollingElement;
  }

  if (isCompliant(document)) {
    return document.documentElement;
  }

  const body = document.body;
  const isFrameset = body && !/body/i.test(body.tagName);
  const possiblyScrollingElement = isFrameset ? getNextBodyElement(body) : body;

  // If `body` is itself scrollable, it is not the `scrollingElement`.
  return possiblyScrollingElement && bodyIsScrollable(possiblyScrollingElement)
    ? null
    : possiblyScrollingElement;
};

const isHidden = (element) => {
  const display = getStyle(element, "display");
  if (display === "none") {
    return false;
  }

  if (
    display === "table-row" ||
    display === "table-group" ||
    display === "table-column"
  ) {
    return getStyle(element, "visibility") !== "collapsed";
  }

  return true;
};
const isCompliant = (document) => {
  // Note: document.compatMode can be toggle at runtime by document.write
  const isStandardsMode = /^CSS1/.test(document.compatMode);
  if (isStandardsMode) {
    return testScrollCompliance(document);
  }
  return false;
};
const testScrollCompliance = (document) => {
  const iframe = document.createElement("iframe");
  iframe.style.height = "1px";
  const parentNode = document.body || document.documentElement || document;
  parentNode.appendChild(iframe);
  const iframeDocument = iframe.contentWindow.document;
  iframeDocument.write('<!DOCTYPE html><div style="height:9999em">x</div>');
  iframeDocument.close();
  const scrollComplianceResult =
    iframeDocument.documentElement.scrollHeight >
    iframeDocument.body.scrollHeight;
  iframe.parentNode.removeChild(iframe);
  return scrollComplianceResult;
};
const getNextBodyElement = (frameset) => {
  // We use this function to be correct per spec in case `document.body` is
  // a `frameset` but there exists a later `body`. Since `document.body` is
  // a `frameset`, we know the root is an `html`, and there was no `body`
  // before the `frameset`, so we just need to look at siblings after the
  // `frameset`.
  let current = frameset;
  while ((current = current.nextSibling)) {
    if (current.nodeType === 1 && isBodyElement(current)) {
      return current;
    }
  }
  return null;
};
const isBodyElement = (element) => element.ownerDocument.body === element;
const bodyIsScrollable = (body) => {
  // a body element is scrollable if body and html are scrollable and rendered
  if (!isScrollable(body)) {
    return false;
  }
  if (isHidden(body)) {
    return false;
  }

  const documentElement = body.ownerDocument.documentElement;
  if (!isScrollable(documentElement)) {
    return false;
  }
  if (isHidden(documentElement)) {
    return false;
  }

  return true;
};

// https://developer.mozilla.org/en-US/docs/Glossary/Scroll_container


const { documentElement: documentElement$2 } = document;

const getScrollContainer = (arg, { includeHidden } = {}) => {
  if (typeof arg !== "object" || arg.nodeType !== 1) {
    throw new TypeError("getScrollContainer first argument must be DOM node");
  }
  const element = arg;
  if (element === document) {
    return null;
  }
  if (element === documentElement$2) {
    if (isScrollable(element, { includeHidden })) {
      return element;
    }
    return null;
  }
  const position = getStyle(element, "position");
  if (position === "fixed") {
    return getScrollingElement(element.ownerDocument);
  }
  return (
    findScrollContainer(element, { includeHidden }) ||
    getScrollingElement(element.ownerDocument)
  );
};

const findScrollContainer = (element, { includeHidden } = {}) => {
  const position = getStyle(element, "position");
  let parent = element.parentNode;
  // Si l'élément est en position absolute, d'abord trouver le premier parent positionné
  if (position === "absolute") {
    while (parent && parent !== document) {
      if (parent === documentElement$2) {
        break; // documentElement est considéré comme positionné
      }
      const parentPosition = getStyle(parent, "position");
      if (parentPosition !== "static") {
        break; // Trouvé le premier parent positionné
      }
      parent = parent.parentNode;
    }
  }

  // Maintenant chercher le premier parent scrollable à partir du parent positionné
  while (parent) {
    if (parent === document) {
      return null;
    }
    if (isScrollable(parent, { includeHidden })) {
      return parent;
    }
    parent = parent.parentNode;
  }
  return null;
};

const getSelfAndAncestorScrolls = (element, startOnParent) => {
  let scrollX = 0;
  let scrollY = 0;
  const ancestorScrolls = [];
  const visitElement = (elementOrScrollContainer) => {
    const scrollContainer = getScrollContainer(elementOrScrollContainer);
    if (scrollContainer) {
      ancestorScrolls.push({
        element: elementOrScrollContainer,
        scrollContainer,
      });
      scrollX += scrollContainer.scrollLeft;
      scrollY += scrollContainer.scrollTop;
      if (scrollContainer === document.documentElement) {
        return;
      }
      visitElement(scrollContainer);
    }
  };
  if (startOnParent) {
    if (element === documentElement$2) ; else {
      visitElement(element.parentNode);
    }
  } else {
    visitElement(element);
  }
  ancestorScrolls.scrollX = scrollX;
  ancestorScrolls.scrollY = scrollY;
  return ancestorScrolls;
};

// https://github.com/shipshapecode/tether/blob/d6817f8c49a7a26b04c45e55589279dd1b5dd2bf/src/js/utils/parents.js#L1
const getScrollContainerSet = (element) => {
  const scrollContainerSet = new Set();
  let elementOrScrollContainer = element;
  while (true) {
    const scrollContainer = getScrollContainer(elementOrScrollContainer);
    if (!scrollContainer) {
      break;
    }
    scrollContainerSet.add(scrollContainer);
    if (scrollContainer === documentElement$2) {
      break;
    }
    elementOrScrollContainer = scrollContainer;
  }
  return scrollContainerSet;
};

const getBorderSizes = (element) => {
  const {
    borderLeftWidth,
    borderRightWidth,
    borderTopWidth,
    borderBottomWidth,
  } = window.getComputedStyle(element, null);
  return {
    left: parseFloat(borderLeftWidth),
    right: parseFloat(borderRightWidth),
    top: parseFloat(borderTopWidth),
    bottom: parseFloat(borderBottomWidth),
  };
};

/**
 * DOM Coordinate Systems: The Missing APIs Problem
 *
 * When positioning and moving DOM elements, we commonly need coordinate information.
 * The web platform provides getBoundingClientRect() which gives viewport-relative coordinates,
 * but this creates several challenges when working with scrollable containers:
 *
 * ## The Problem
 *
 * 1. **Basic positioning**: getBoundingClientRect() works great for viewport-relative positioning
 * 2. **Document scrolling**: When document has scroll, we add document.scrollLeft/scrollTop
 * 3. **Scroll containers**: When elements are inside scrollable containers, we need coordinates
 *    relative to that container, not the document
 *
 * ## Missing Browser APIs
 *
 * The web platform lacks essential APIs for scroll container workflows:
 * - No equivalent of getBoundingClientRect() relative to scroll container
 * - No built-in way to get element coordinates in scroll container space
 * - Manual coordinate conversion is error-prone and inconsistent
 *
 * ## This Module's Solution
 *
 * This module provides the missing coordinate APIs that work seamlessly with scroll containers:
 * - **getScrollRelativeRect()**: element rect relative to scroll container (PRIMARY API)
 * - **getMouseEventScrollRelativeRect()**: Mouse coordinates in scroll container space
 * - **convertScrollRelativeRectInto()**: Convert scroll-relative rect to element positioning coordinates
 *
 * These APIs abstract away the complexity of coordinate system conversion and provide
 * a consistent interface for element positioning regardless of scroll container depth.
 *
 * ## Primary API: getScrollRelativeRect()
 *
 * This is the main API you want - element rectangle relative to scroll container:
 *
 * ```js
 * const rect = element.getBoundingClientRect(); // viewport-relative
 * const scrollRect = getScrollRelativeRect(element, scrollContainer); // scroll-relative
 * ```
 *
 * Returns: { left, top, right, bottom, width, height, scrollLeft, scrollTop, scrollContainer, ...metadata }
 *
 * The scroll values are included so you can calculate scroll-absolute coordinates yourself:
 * ```js
 * const { left, top, scrollLeft, scrollTop } = getScrollRelativeRect(element);
 * const scrollAbsoluteLeft = left + scrollLeft;
 * const scrollAbsoluteTop = top + scrollTop;
 * ```
 *
 * ## Secondary APIs:
 *
 * - **getMouseEventScrollRelativeRect()**: Get mouse coordinates as a rect in scroll container space
 * - **convertScrollRelativeRectInto()**: Convert from scroll-relative coordinates to element positioning coordinates (for setting element.style.left/top)
 *
 * ## Coordinate System Terminology:
 *
 * - **Viewport-relative**: getBoundingClientRect() coordinates - relative to browser viewport
 * - **Scroll-relative**: Coordinates relative to scroll container (ignoring current scroll position)
 * - **Scroll-absolute**: Scroll-relative + scroll position (element's position in full scrollable content)
 * - **Element coordinates**: Coordinates for positioning elements (via element.style.left/top)
 *
 * ## Legacy Coordinate System Diagrams
 *
 * X-Axis Coordinate Systems in Web Development
 *
 * Diagram showing horizontal positioning and scrollbars:
 *
 * VIEWPORT (visible part of the document)
 * ┌───────────────────────────────────────────────┐
 * │                                               │
 * │                                               │
 * │ container.offsetLeft: 20px                    │
 * │       ┼─────────────────────────────┐         │
 * │       │                             │         │
 * │       │                             │         │
 * │       │  el.offsetLeft: 100px       │         │
 * │       │         ┼─────┐             │         │
 * │       │         │     │             │         │
 * │       │         └─────┘             │         │
 * │       │                             │         │
 * │       │ ░░░███░░░░░░░░░░░░░░░░░░░░░ │         │
 * │       └─────│───────────────────────┘         │
 * │ container.scrollLeft: 50px                    │
 * │                                               │
 * │                                               │
 * │ ░░░░░░░███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
 * └─────────│─────────────────────────────────────┘
 *   document.scrollLeft: 200px
 *
 *
 * Left coordinate for the element:
 *
 * Document coordinates (absolute position in full document)
 * • Result: 320px
 * • Detail: container.offsetLeft + element.offsetLeft + document.scrollLeft
 *           20                +  100              + 200               = 320px
 *
 * Viewport coordinates (getBoundingClientRect().left):
 * • Result: 120px
 * • Detail: container.offsetLeft + element.offsetLeft
 *           20                +  100              = 120px
 *
 * Scroll coordinates (position within scroll container):
 * • Result: 50px
 * • Detail: element.offsetLeft - container.scrollLeft
 *           100              - 50                 = 50px
 *
 * Scroll behavior examples:
 *
 * When document scrolls (scrollLeft: 200px → 300px):
 * • Document coordinates: 320px → 420px
 * • Viewport coordinates: 120px → 120px (unchanged)
 * • Scroll coordinates: 50px → 50px (unchanged)
 *
 * When container scrolls (scrollLeft: 50px → 100px):
 * • Document coordinates: 320px → 270px
 * • Viewport coordinates: 120px → 70px
 * • Scroll coordinates: 50px → 0px
 */


const { documentElement: documentElement$1 } = document;

/**
 * Get element rectangle relative to its scroll container
 *
 * @param {Element} element - The element to get coordinates for
 * @param {Element} [scrollContainer] - Optional scroll container (auto-detected if not provided)
 * @param {object} [options] - Configuration options
 * @returns {object} { left, top, right, bottom, width, height, scrollLeft, scrollTop, scrollContainer, ...metadata }
 */
const getScrollRelativeRect = (
  element,
  scrollContainer = getScrollContainer(element),
  { useOriginalPositionEvenIfSticky = false } = {},
) => {
  const {
    left: leftViewport,
    top: topViewport,
    width,
    height,
  } = element.getBoundingClientRect();

  let fromFixed = false;
  let fromStickyLeft;
  let fromStickyTop;
  let fromStickyLeftAttr;
  let fromStickyTopAttr;
  const scrollLeft = scrollContainer.scrollLeft;
  const scrollTop = scrollContainer.scrollTop;
  const scrollContainerIsDocument = scrollContainer === documentElement$1;
  const createScrollRelativeRect = (leftScrollRelative, topScrollRelative) => {
    const isStickyLeftOrHasStickyLeftAttr = Boolean(
      fromStickyLeft || fromStickyLeftAttr,
    );
    const isStickyTopOrHasStickyTopAttr = Boolean(
      fromStickyTop || fromStickyTopAttr,
    );
    return {
      left: leftScrollRelative,
      top: topScrollRelative,
      right: leftScrollRelative + width,
      bottom: topScrollRelative + height,

      // metadata
      width,
      height,
      scrollContainer,
      scrollContainerIsDocument,
      scrollLeft,
      scrollTop,
      fromFixed,
      fromStickyLeft,
      fromStickyTop,
      fromStickyLeftAttr,
      fromStickyTopAttr,
      isStickyLeftOrHasStickyLeftAttr,
      isStickyTopOrHasStickyTopAttr,
      isSticky:
        isStickyLeftOrHasStickyLeftAttr || isStickyTopOrHasStickyTopAttr,
    };
  };

  {
    const computedStyle = getComputedStyle(element);
    {
      const usePositionSticky = computedStyle.position === "sticky";
      if (usePositionSticky) {
        // For CSS position:sticky elements, use scrollable-relative coordinates
        const [leftScrollRelative, topScrollRelative] =
          viewportPosToScrollRelativePos(
            leftViewport,
            topViewport,
            scrollContainer,
          );
        const isStickyLeft = computedStyle.left !== "auto";
        const isStickyTop = computedStyle.top !== "auto";
        fromStickyLeft = isStickyLeft
          ? { value: parseFloat(computedStyle.left) || 0 }
          : undefined;
        fromStickyTop = isStickyTop
          ? { value: parseFloat(computedStyle.top) || 0 }
          : undefined;
        return createScrollRelativeRect(leftScrollRelative, topScrollRelative);
      }
    }
    {
      const hasStickyLeftAttribute = element.hasAttribute("data-sticky-left");
      const hasStickyTopAttribute = element.hasAttribute("data-sticky-top");
      const useStickyAttribute =
        hasStickyLeftAttribute || hasStickyTopAttribute;
      if (useStickyAttribute) {
        // Handle virtually sticky obstacles (<col> or <tr>) - elements with data-sticky attributes
        // but not CSS position:sticky. Calculate their position based on scroll and sticky behavior
        let [leftScrollRelative, topScrollRelative] =
          viewportPosToScrollRelativePos(
            leftViewport,
            topViewport,
            scrollContainer,
          );
        if (hasStickyLeftAttribute) {
          const leftCssValue = parseFloat(computedStyle.left) || 0;
          fromStickyLeftAttr = { value: leftCssValue };
          if (useOriginalPositionEvenIfSticky) ; else {
            const scrollLeft = scrollContainer.scrollLeft;
            const stickyPosition = scrollLeft + leftCssValue;
            const leftWithScroll = leftScrollRelative + scrollLeft;
            if (stickyPosition > leftWithScroll) {
              leftScrollRelative = leftCssValue; // Element is stuck
            }
          }
        }
        if (hasStickyTopAttribute) {
          const topCssValue = parseFloat(computedStyle.top) || 0;
          fromStickyTopAttr = { value: topCssValue };
          if (useOriginalPositionEvenIfSticky) ; else {
            const scrollTop = scrollContainer.scrollTop;
            const stickyPosition = scrollTop + topCssValue;
            const topWithScroll = topScrollRelative + scrollTop;
            if (stickyPosition > topWithScroll) {
              topScrollRelative = topCssValue; // Element is stuck
            }
          }
        }
        return createScrollRelativeRect(leftScrollRelative, topScrollRelative);
      }
    }
  }

  // For normal elements, use scrollable-relative coordinates
  const [leftScrollRelative, topScrollRelative] =
    viewportPosToScrollRelativePos(leftViewport, topViewport, scrollContainer);
  return createScrollRelativeRect(leftScrollRelative, topScrollRelative);
};
const viewportPosToScrollRelativePos = (
  leftViewport,
  topViewport,
  scrollContainer,
) => {
  const scrollContainerIsDocument = scrollContainer === documentElement$1;
  if (scrollContainerIsDocument) {
    return [leftViewport, topViewport];
  }
  const { left: scrollContainerLeftViewport, top: scrollContainerTopViewport } =
    scrollContainer.getBoundingClientRect();
  return [
    leftViewport - scrollContainerLeftViewport,
    topViewport - scrollContainerTopViewport,
  ];
};

const addScrollToRect = (scrollRelativeRect) => {
  const { left, top, width, height, scrollLeft, scrollTop } =
    scrollRelativeRect;
  const leftWithScroll = left + scrollLeft;
  const topWithScroll = top + scrollTop;
  return {
    ...scrollRelativeRect,
    left: leftWithScroll,
    top: topWithScroll,
    right: leftWithScroll + width,
    bottom: topWithScroll + height,
  };
};

// https://github.com/w3c/csswg-drafts/issues/3329
// Return the portion of the element that is visible for this scoll container
const getScrollBox = (scrollContainer) => {
  if (scrollContainer === documentElement$1) {
    const { clientWidth, clientHeight } = documentElement$1;

    return {
      left: 0,
      top: 0,
      right: clientWidth,
      bottom: clientHeight,
      width: clientWidth,
      height: clientHeight,
    };
  }

  const { clientWidth, clientHeight } = scrollContainer;
  const scrollContainerBorderSizes = getBorderSizes(scrollContainer);
  const left = scrollContainerBorderSizes.left;
  const top = scrollContainerBorderSizes.top;
  const right = left + clientWidth;
  const bottom = top + clientHeight;
  return {
    left,
    top,
    right,
    bottom,
    width: clientWidth,
    height: clientHeight,
  };
};
// https://developer.mozilla.org/en-US/docs/Glossary/Scroll_container#scrollport
const getScrollport = (scrollBox, scrollContainer) => {
  const { left, top, width, height } = scrollBox;
  const leftWithScroll = left + scrollContainer.scrollLeft;
  const topWithScroll = top + scrollContainer.scrollTop;
  const rightWithScroll = leftWithScroll + width;
  const bottomWithScroll = topWithScroll + height;
  return {
    left: leftWithScroll,
    top: topWithScroll,
    right: rightWithScroll,
    bottom: bottomWithScroll,
  };
};

// https://davidwalsh.name/detect-scrollbar-width
const measureScrollbar = (scrollableElement) => {
  const hasXScrollbar =
    scrollableElement.scrollHeight > scrollableElement.clientHeight;
  const hasYScrollbar =
    scrollableElement.scrollWidth > scrollableElement.clientWidth;
  if (!hasXScrollbar && !hasYScrollbar) {
    return [0, 0];
  }
  const scrollDiv = document.createElement("div");
  scrollDiv.style.cssText = `position: absolute; width: 100px; height: 100px; overflow: scroll; pointer-events: none; visibility: hidden;`;
  scrollableElement.appendChild(scrollDiv);
  const scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth;
  const scrollbarHeight = scrollDiv.offsetHeight - scrollDiv.clientHeight;
  scrollableElement.removeChild(scrollDiv);
  return [
    hasXScrollbar ? scrollbarWidth : 0,
    hasYScrollbar ? scrollbarHeight : 0,
  ];
};

/**
 * Prevents unwanted scrollbars during dimension transitions.
 *
 * Problem: When animating from one size to another, intermediate dimensions
 * might temporarily trigger scrollbars that shouldn't exist in the final state.
 * This creates visual flicker and layout shifts.
 *
 * Solution: Detect when intermediate animation frames would create problematic
 * scrollbars and temporarily hide overflow during the transition.
 */
const preventIntermediateScrollbar = (
  element,
  { fromWidth, toWidth, fromHeight, toHeight, onPrevent, onRestore },
) => {
  const scrollContainer = getScrollContainer(element);
  const [scrollbarWidth, scrollbarHeight] = measureScrollbar(scrollContainer);
  const scrollBox = getScrollBox(scrollContainer);
  const scrollContainerWidth = scrollBox.width + scrollbarWidth;
  const scrollContainerHeight = scrollBox.height + scrollbarHeight;

  const currentScrollbarState = getScrollbarState(fromWidth, fromHeight, {
    scrollContainerWidth,
    scrollContainerHeight,
    scrollbarWidth,
    scrollbarHeight,
  });
  const finalScrollbarState = getScrollbarState(toWidth, toHeight, {
    scrollContainerWidth,
    scrollContainerHeight,
    scrollbarWidth,
    scrollbarHeight,
  });
  if (
    currentScrollbarState.x === finalScrollbarState.x &&
    currentScrollbarState.y === finalScrollbarState.y
  ) {
    return () => {};
  }

  // Simulate worst case during transition - when both dimensions are at their maximum
  const maxWidth = Math.max(fromWidth, toWidth);
  const maxHeight = Math.max(fromHeight, toHeight);
  let availableWidth = scrollContainerWidth;
  let availableHeight = scrollContainerHeight;
  let wouldHaveXDuringTransition = maxWidth > availableWidth;
  let wouldHaveYDuringTransition = maxHeight > availableHeight;
  if (wouldHaveXDuringTransition) {
    availableHeight -= scrollbarHeight; // X scrollbar reduces available Y space
    wouldHaveYDuringTransition = maxHeight > availableHeight; // Re-check Y with reduced space
  }
  if (wouldHaveYDuringTransition) {
    availableWidth -= scrollbarWidth; // Y scrollbar reduces available X space
    wouldHaveXDuringTransition = maxWidth > availableWidth; // Re-check X with reduced space
  }
  const intermediateX = wouldHaveXDuringTransition && !finalScrollbarState.x;
  const intermediateY = wouldHaveYDuringTransition && !finalScrollbarState.y;
  if (!intermediateX && !intermediateY) {
    return () => {};
  }

  // Apply prevention
  const originalOverflowX = scrollContainer.style.overflowX;
  const originalOverflowY = scrollContainer.style.overflowY;
  if (intermediateX) {
    scrollContainer.style.overflowX = "hidden";
  }
  if (intermediateY) {
    scrollContainer.style.overflowY = "hidden";
  }
  onPrevent?.({
    x: intermediateX,
    y: intermediateY,
    scrollContainer,
  });
  return () => {
    if (intermediateX) {
      scrollContainer.style.overflowX = originalOverflowX;
    }
    if (intermediateY) {
      scrollContainer.style.overflowY = originalOverflowY;
    }
    onRestore?.({
      x: intermediateX,
      y: intermediateY,
      scrollContainer,
    });
  };
};

const getScrollbarState = (
  contentWidth,
  contentHeight,
  {
    scrollContainerWidth,
    scrollContainerHeight,
    scrollbarWidth,
    scrollbarHeight,
  },
) => {
  let availableWidth = scrollContainerWidth;
  let availableHeight = scrollContainerHeight;
  const contentExceedsWidth = contentWidth > availableWidth;
  const contentExceedsHeight = contentHeight > availableHeight;

  // Start with basic overflow
  let x = contentExceedsWidth;
  let y = contentExceedsHeight;
  // If Y scrollbar appears, it reduces available X space
  if (y) {
    availableWidth -= scrollbarWidth;
    // Re-check X scrollbar with reduced space
    x = contentWidth > availableWidth;
  }
  // If X scrollbar appears, it reduces available Y space
  if (x) {
    availableHeight -= scrollbarHeight;
    // Re-check Y scrollbar with reduced space
    y = contentHeight > availableHeight;
  }

  return { x, y, availableWidth, availableHeight };
};

const trapScrollInside = (element) => {
  const cleanupCallbackSet = new Set();
  const lockScroll = (el) => {
    const [scrollbarWidth, scrollbarHeight] = measureScrollbar(el);
    // scrollbar-gutter would work but would display an empty blank space
    const paddingRight = parseInt(getStyle(el, "padding-right"), 0);
    const paddingTop = parseInt(getStyle(el, "padding-top"), 0);
    const removeScrollLockStyles = setStyles(el, {
      "padding-right": `${paddingRight + scrollbarWidth}px`,
      "padding-top": `${paddingTop + scrollbarHeight}px`,
      "overflow": "hidden",
    });
    cleanupCallbackSet.add(() => {
      removeScrollLockStyles();
    });
  };
  let previous = element.previousSibling;
  while (previous) {
    if (previous.nodeType === 1) {
      if (isScrollable(previous)) {
        lockScroll(previous);
      }
    }
    previous = previous.previousSibling;
  }

  const selfAndAncestorScrolls = getSelfAndAncestorScrolls(element);
  for (const selfOrAncestorScroll of selfAndAncestorScrolls) {
    const elementToScrollLock = selfOrAncestorScroll.scrollContainer;
    lockScroll(elementToScrollLock);
  }

  return () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };
};

/**
 * Creates intuitive scrolling behavior when scrolling over an element that needs to stay interactive
 * (we can't use pointer-events: none). Instead of scrolling the document unexpectedly,
 * finds and scrolls the appropriate scrollable container behind the overlay.
 */


const allowWheelThrough = (element, connectedElement) => {
  const isElementOrDescendant = (possibleDescendant) => {
    return (
      possibleDescendant === element || element.contains(possibleDescendant)
    );
  };
  const tryToScrollOne = (element, wheelEvent) => {
    if (element === document.documentElement) {
      // let browser handle document scrolling
      return true;
    }

    const { deltaX, deltaY } = wheelEvent;
    // we found what we want: a scrollable container behind the element
    // we try to scroll it.
    const elementCanApplyScrollDeltaX =
      deltaX && canApplyScrollDelta(element, deltaX, "x");
    const elementCanApplyScrollDeltaY =
      deltaY && canApplyScrollDelta(element, deltaY, "y");
    if (!elementCanApplyScrollDeltaX && !elementCanApplyScrollDeltaY) {
      return false;
    }
    if (!isScrollable(element)) {
      return false;
    }
    const belongsToElement = isElementOrDescendant(element);
    if (belongsToElement) {
      // let browser handle the scroll on the element itself
      return true;
    }
    wheelEvent.preventDefault();
    applyWheelScrollThrough(element, wheelEvent);
    return true;
  };

  if (connectedElement) {
    const onWheel = (wheelEvent) => {
      const connectedScrollContainer = getScrollContainer(connectedElement);
      if (connectedScrollContainer === document.documentElement) {
        // the connected scrollable parent is the document
        // there is nothing to do, browser native scroll will work as we want
        return;
      }

      const elementsBehindMouse = document.elementsFromPoint(
        wheelEvent.clientX,
        wheelEvent.clientY,
      );
      for (const elementBehindMouse of elementsBehindMouse) {
        // try to scroll element itself
        if (tryToScrollOne(elementBehindMouse, wheelEvent)) {
          return;
        }
        const belongsToElement = isElementOrDescendant(elementBehindMouse);
        // try to scroll what is behind
        if (!belongsToElement) {
          break;
        }
      }
      // At this stage the element has no scrollable parts
      // we can try to scroll the connected scrollable parent
      tryToScrollOne(connectedScrollContainer, wheelEvent);
    };
    element.addEventListener("wheel", onWheel);
    return;
  }

  const onWheel = (wheelEvent) => {
    const elementsBehindMouse = document.elementsFromPoint(
      wheelEvent.clientX,
      wheelEvent.clientY,
    );
    for (const elementBehindMouse of elementsBehindMouse) {
      // try to scroll element itself
      if (tryToScrollOne(elementBehindMouse, wheelEvent)) {
        return;
      }
      const belongsToElement = isElementOrDescendant(elementBehindMouse);
      if (belongsToElement) {
        // keep searching if something in our element is scrollable
        continue;
      }
      // our element is not scrollable, try to scroll the container behind the mouse
      const scrollContainer = getScrollContainer(elementBehindMouse);
      if (tryToScrollOne(scrollContainer, wheelEvent)) {
        return;
      }
    }
  };
  element.addEventListener("wheel", onWheel);
};

const canApplyScrollDelta = (element, delta, axis) => {
  const {
    clientWidth,
    clientHeight,
    scrollWidth,
    scrollHeight,
    scrollLeft,
    scrollTop,
  } = element;

  let size = axis === "x" ? clientWidth : clientHeight;
  let currentScroll = axis === "x" ? scrollLeft : scrollTop;
  let scrollEnd = axis === "x" ? scrollWidth : scrollHeight;

  if (size === scrollEnd) {
    // when scrollWidth === clientWidth, there is no scroll to apply
    return false;
  }
  if (delta < 0 && currentScroll <= 0) {
    // when scrollLeft is 0, we can't scroll to the left
    return false;
  }
  if (delta > 0 && currentScroll + size >= scrollEnd) {
    // when scrollLeft + size >= scrollWidth, we can't scroll to the right
    return false;
  }
  return true;
};

const applyWheelScrollThrough = (element, wheelEvent) => {
  wheelEvent.preventDefault();
  element.scrollBy({
    top: wheelEvent.deltaY,
    left: wheelEvent.deltaX,
    behavior: wheelEvent.deltaMode === 0 ? "auto" : "smooth", // optional tweak
  });
};

const findSelfOrAncestorFixedPosition = (element) => {
  let current = element;
  while (true) {
    const computedStyle = window.getComputedStyle(current);
    if (computedStyle.position === "fixed") {
      const { left, top } = current.getBoundingClientRect();
      return [left, top];
    }
    current = current.parentElement;
    if (!current || current === document.documentElement) {
      break;
    }
  }
  return null;
};

/**
 * Creates a coordinate system positioner for drag operations.
 *
 * ARCHITECTURE:
 * This function uses a modular offset-based approach to handle coordinate system conversions
 * between different positioning contexts (scroll containers and positioned parents).
 *
 * The system decomposes coordinate conversion into two types of offsets:
 * 1. Position offsets - compensate for different positioned parents
 * 2. Scroll offsets - handle scroll position and container differences
 *
 * COORDINATE SYSTEM:
 * - Input coordinates are relative to the reference element's scroll container
 * - Output coordinates are relative to the element's positioned parent for DOM positioning
 * - Handles cross-coordinate system scenarios (different scroll containers and positioned parents)
 *
 * KEY SCENARIOS SUPPORTED:
 * 1. Same positioned parent, same scroll container - Simple case, minimal offsets
 * 2. Different positioned parents, same scroll container - Position offset compensation
 * 3. Same positioned parent, different scroll containers - Scroll offset handling
 * 4. Different positioned parents, different scroll containers - Full offset compensation
 * 5. Overlay elements - Special handling for elements with data-overlay-for attribute
 * 6. Fixed positioning - Special scroll offset handling for fixed positioned elements
 *
 * API CONTRACT:
 * Returns [scrollableLeft, scrollableTop, convertScrollablePosition] where:
 *
 * - scrollableLeft/scrollableTop:
 *   Current element coordinates in the reference coordinate system (adjusted for position offsets)
 *
 * - convertScrollablePosition:
 *   Converts reference coordinate system positions to DOM positioning coordinates
 *   Applies both position and scroll offsets for accurate element placement
 *
 * IMPLEMENTATION STRATEGY:
 * Uses factory functions to create specialized offset calculators based on the specific
 * combination of positioning contexts, optimizing for performance and code clarity.
 */

const createDragElementPositioner = (
  element,
  referenceElement,
  elementToMove,
) => {
  let scrollableLeft;
  let scrollableTop;
  let convertScrollablePosition;

  const positionedParent = elementToMove
    ? elementToMove.offsetParent
    : element.offsetParent;
  const scrollContainer = getScrollContainer(element);
  const [getPositionOffsets, getScrollOffsets] = createGetOffsets({
    positionedParent,
    referencePositionedParent: referenceElement
      ? referenceElement.offsetParent
      : undefined,
    scrollContainer,
    referenceScrollContainer: referenceElement
      ? getScrollContainer(referenceElement)
      : undefined,
  });

  {
    [scrollableLeft, scrollableTop] = getScrollablePosition(
      element,
      scrollContainer,
    );
    const [positionOffsetLeft, positionOffsetTop] = getPositionOffsets();
    scrollableLeft += positionOffsetLeft;
    scrollableTop += positionOffsetTop;
  }
  {
    convertScrollablePosition = (
      scrollableLeftToConvert,
      scrollableTopToConvert,
    ) => {
      const [positionOffsetLeft, positionOffsetTop] = getPositionOffsets();
      const [scrollOffsetLeft, scrollOffsetTop] = getScrollOffsets();

      const positionedLeftWithoutScroll =
        scrollableLeftToConvert + positionOffsetLeft;
      const positionedTopWithoutScroll =
        scrollableTopToConvert + positionOffsetTop;
      const positionedLeft = positionedLeftWithoutScroll + scrollOffsetLeft;
      const positionedTop = positionedTopWithoutScroll + scrollOffsetTop;

      return [positionedLeft, positionedTop];
    };
  }
  return [scrollableLeft, scrollableTop, convertScrollablePosition];
};

const getScrollablePosition = (element, scrollContainer) => {
  const { left: elementViewportLeft, top: elementViewportTop } =
    element.getBoundingClientRect();
  const scrollContainerIsDocument = scrollContainer === documentElement;
  if (scrollContainerIsDocument) {
    return [elementViewportLeft, elementViewportTop];
  }
  const { left: scrollContainerLeft, top: scrollContainerTop } =
    scrollContainer.getBoundingClientRect();
  const scrollableLeft = elementViewportLeft - scrollContainerLeft;
  const scrollableTop = elementViewportTop - scrollContainerTop;

  return [scrollableLeft, scrollableTop];
};

const createGetOffsets = ({
  positionedParent,
  referencePositionedParent = positionedParent,
  scrollContainer,
  referenceScrollContainer = scrollContainer,
}) => {
  const samePositionedParent = positionedParent === referencePositionedParent;
  const getScrollOffsets = createGetScrollOffsets(
    scrollContainer,
    referenceScrollContainer,
    positionedParent,
    samePositionedParent,
  );

  if (samePositionedParent) {
    return [() => [0, 0], getScrollOffsets];
  }

  // parents are different, oh boy let's go
  // The overlay case is problematic because the overlay adjust its position to the target dynamically
  // This creates something complex to support properly.
  // When overlay is fixed we there will never be any offset
  // When overlay is absolute there is a diff relative to the scroll
  // and eventually if the overlay is positioned differently than the other parent
  if (isOverlayOf(positionedParent, referencePositionedParent)) {
    return createGetOffsetsForOverlay(
      positionedParent,
      referencePositionedParent,
      {
        scrollContainer,
        referenceScrollContainer,
        getScrollOffsets,
      },
    );
  }
  if (isOverlayOf(referencePositionedParent, positionedParent)) {
    return createGetOffsetsForOverlay(
      referencePositionedParent,
      positionedParent,
      {
        scrollContainer,
        referenceScrollContainer,
        getScrollOffsets,
      },
    );
  }
  const scrollContainerIsDocument = scrollContainer === documentElement;
  if (scrollContainerIsDocument) {
    // Document case: getBoundingClientRect already includes document scroll effects
    // Add current scroll position to get the static offset
    const getPositionOffsetsDocumentScrolling = () => {
      const { scrollLeft: documentScrollLeft, scrollTop: documentScrollTop } =
        scrollContainer;
      const aRect = positionedParent.getBoundingClientRect();
      const bRect = referencePositionedParent.getBoundingClientRect();
      const aLeft = aRect.left;
      const aTop = aRect.top;
      const bLeft = bRect.left;
      const bTop = bRect.top;
      const aLeftDocument = documentScrollLeft + aLeft;
      const aTopDocument = documentScrollTop + aTop;
      const bLeftDocument = documentScrollLeft + bLeft;
      const bTopDocument = documentScrollTop + bTop;
      const offsetLeft = bLeftDocument - aLeftDocument;
      const offsetTop = bTopDocument - aTopDocument;
      return [offsetLeft, offsetTop];
    };
    return [getPositionOffsetsDocumentScrolling, getScrollOffsets];
  }
  // Custom scroll container case: account for container's position and scroll
  const getPositionOffsetsCustomScrollContainer = () => {
    const aRect = positionedParent.getBoundingClientRect();
    const bRect = referencePositionedParent.getBoundingClientRect();
    const aLeft = aRect.left;
    const aTop = aRect.top;
    const bLeft = bRect.left;
    const bTop = bRect.top;

    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    const offsetLeft =
      bLeft - aLeft + scrollContainer.scrollLeft - scrollContainerRect.left;
    const offsetTop =
      bTop - aTop + scrollContainer.scrollTop - scrollContainerRect.top;
    return [offsetLeft, offsetTop];
  };
  return [getPositionOffsetsCustomScrollContainer, getScrollOffsets];
};
const createGetOffsetsForOverlay = (
  overlay,
  overlayTarget,
  { scrollContainer, referenceScrollContainer, getScrollOffsets },
) => {
  const sameScrollContainer = scrollContainer === referenceScrollContainer;
  const scrollContainerIsDocument =
    scrollContainer === document.documentElement;
  const referenceScrollContainerIsDocument =
    referenceScrollContainer === documentElement;

  if (getComputedStyle(overlay).position === "fixed") {
    if (referenceScrollContainerIsDocument) {
      const getPositionOffsetsFixedOverlay = () => {
        return [0, 0];
      };
      return [getPositionOffsetsFixedOverlay, getScrollOffsets];
    }
    const getPositionOffsetsFixedOverlay = () => {
      const scrollContainerRect = scrollContainer.getBoundingClientRect();
      const referenceScrollContainerRect =
        referenceScrollContainer.getBoundingClientRect();
      let offsetLeftBetweenScrollContainers =
        referenceScrollContainerRect.left - scrollContainerRect.left;
      let offsetTopBetweenScrollContainers =
        referenceScrollContainerRect.top - scrollContainerRect.top;
      if (scrollContainerIsDocument) {
        offsetLeftBetweenScrollContainers -= scrollContainer.scrollLeft;
        offsetTopBetweenScrollContainers -= scrollContainer.scrollTop;
      }
      return [
        -offsetLeftBetweenScrollContainers,
        -offsetTopBetweenScrollContainers,
      ];
    };
    return [getPositionOffsetsFixedOverlay, getScrollOffsets];
  }

  const getPositionOffsetsOverlay = () => {
    if (sameScrollContainer) {
      const overlayRect = overlay.getBoundingClientRect();
      const overlayTargetRect = overlayTarget.getBoundingClientRect();
      const overlayLeft = overlayRect.left;
      const overlayTop = overlayRect.top;
      let overlayTargetLeft = overlayTargetRect.left;
      let overlayTargetTop = overlayTargetRect.top;
      if (scrollContainerIsDocument) {
        overlayTargetLeft += scrollContainer.scrollLeft;
        overlayTargetTop += scrollContainer.scrollTop;
      }
      const offsetLeftBetweenTargetAndOverlay = overlayTargetLeft - overlayLeft;
      const offsetTopBetweenTargetAndOverlay = overlayTargetTop - overlayTop;
      return [
        -scrollContainer.scrollLeft + offsetLeftBetweenTargetAndOverlay,
        -scrollContainer.scrollTop + offsetTopBetweenTargetAndOverlay,
      ];
    }

    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    const referenceScrollContainerRect =
      referenceScrollContainer.getBoundingClientRect();
    let scrollContainerLeft = scrollContainerRect.left;
    let scrollContainerTop = scrollContainerRect.top;
    let referenceScrollContainerLeft = referenceScrollContainerRect.left;
    let referenceScrollContainerTop = referenceScrollContainerRect.top;
    if (scrollContainerIsDocument) {
      scrollContainerLeft += scrollContainer.scrollLeft;
      scrollContainerTop += scrollContainer.scrollTop;
    }
    const offsetLeftBetweenScrollContainers =
      referenceScrollContainerLeft - scrollContainerLeft;
    const offsetTopBetweenScrollContainers =
      referenceScrollContainerTop - scrollContainerTop;
    return [
      -offsetLeftBetweenScrollContainers - referenceScrollContainer.scrollLeft,
      -offsetTopBetweenScrollContainers - referenceScrollContainer.scrollTop,
    ];
  };
  const getScrollOffsetsOverlay = () => {
    if (sameScrollContainer) {
      return [scrollContainer.scrollLeft, scrollContainer.scrollTop];
    }

    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    const referenceScrollContainerRect =
      referenceScrollContainer.getBoundingClientRect();
    let offsetLeftBetweenScrollContainers =
      referenceScrollContainerRect.left - scrollContainerRect.left;
    let offsetTopBetweenScrollContainers =
      referenceScrollContainerRect.top - scrollContainerRect.top;
    if (scrollContainerIsDocument) {
      offsetLeftBetweenScrollContainers -= scrollContainer.scrollLeft;
      offsetTopBetweenScrollContainers -= scrollContainer.scrollTop;
    }

    return [
      referenceScrollContainer.scrollLeft + offsetLeftBetweenScrollContainers,
      referenceScrollContainer.scrollTop + offsetTopBetweenScrollContainers,
    ];
  };
  return [getPositionOffsetsOverlay, getScrollOffsetsOverlay];
};
const isOverlayOf = (element, potentialTarget) => {
  const overlayForAttribute = element.getAttribute("data-overlay-for");
  if (!overlayForAttribute) {
    return false;
  }
  const overlayTarget = document.querySelector(`#${overlayForAttribute}`);
  if (!overlayTarget) {
    return false;
  }
  if (overlayTarget === potentialTarget) {
    return true;
  }
  const overlayTargetPositionedParent = overlayTarget.offsetParent;
  if (overlayTargetPositionedParent === potentialTarget) {
    return true;
  }
  return false;
};

const { documentElement } = document;
const createGetScrollOffsets = (
  scrollContainer,
  referenceScrollContainer,
  positionedParent,
  samePositionedParent,
) => {
  const getGetScrollOffsetsSameContainer = () => {
    const scrollContainerIsDocument = scrollContainer === documentElement;
    // I don't really get why we have to add scrollLeft (scrollLeft at grab)
    // to properly position the element in this scenario
    // It happens since we use translateX to position the element
    // Or maybe since something else. In any case it works
    const { scrollLeft, scrollTop } = samePositionedParent
      ? { scrollLeft: 0, scrollTop: 0 }
      : referenceScrollContainer;
    if (scrollContainerIsDocument) {
      const fixedPosition = findSelfOrAncestorFixedPosition(positionedParent);
      if (fixedPosition) {
        const getScrollOffsetsFixed = () => {
          const leftScrollToAdd = scrollLeft + fixedPosition[0];
          const topScrollToAdd = scrollTop + fixedPosition[1];
          return [leftScrollToAdd, topScrollToAdd];
        };
        return getScrollOffsetsFixed;
      }
    }
    const getScrollOffsets = () => {
      const leftScrollToAdd = scrollLeft + referenceScrollContainer.scrollLeft;
      const topScrollToAdd = scrollTop + referenceScrollContainer.scrollTop;
      return [leftScrollToAdd, topScrollToAdd];
    };
    return getScrollOffsets;
  };

  const sameScrollContainer = scrollContainer === referenceScrollContainer;
  const getScrollOffsetsSameContainer = getGetScrollOffsetsSameContainer();
  if (sameScrollContainer) {
    return getScrollOffsetsSameContainer;
  }
  const getScrollOffsetsDifferentContainers = () => {
    const [scrollLeftToAdd, scrollTopToAdd] = getScrollOffsetsSameContainer();
    const rect = scrollContainer.getBoundingClientRect();
    const referenceRect = referenceScrollContainer.getBoundingClientRect();
    const leftDiff = referenceRect.left - rect.left;
    const topDiff = referenceRect.top - rect.top;
    return [scrollLeftToAdd + leftDiff, scrollTopToAdd + topDiff];
  };
  return getScrollOffsetsDifferentContainers;
};
const getDragCoordinates = (
  element,
  scrollContainer = getScrollContainer(element),
) => {
  const [scrollableLeft, scrollableTop] = getScrollablePosition(
    element,
    scrollContainer,
  );
  const { scrollLeft, scrollTop } = scrollContainer;
  const leftRelativeToScrollContainer = scrollableLeft + scrollLeft;
  const topRelativeToScrollContainer = scrollableTop + scrollTop;
  return [leftRelativeToScrollContainer, topRelativeToScrollContainer];
};

const installImportMetaCss = (importMeta) => {
  const stylesheet = new CSSStyleSheet({ baseUrl: importMeta.url });

  let called = false;
  // eslint-disable-next-line accessor-pairs
  Object.defineProperty(importMeta, "css", {
    configurable: true,
    set(value) {
      if (called) {
        throw new Error("import.meta.css setter can only be called once");
      }
      called = true;
      stylesheet.replaceSync(value);
      document.adoptedStyleSheets = [
        ...document.adoptedStyleSheets,
        stylesheet,
      ];
    },
  });
};

/**
 * Isolates user interactions to only the specified elements, making everything else non-interactive.
 *
 * This creates a controlled interaction environment where only the target elements (and their ancestors)
 * can receive user input like clicks, keyboard events, focus, etc. All other DOM elements become
 * non-interactive, preventing conflicting or unwanted interactions during critical operations
 * like drag gestures, modal dialogs, or complex UI states.
 *
 * The function uses the `inert` attribute to achieve this isolation, applying it strategically
 * to parts of the DOM tree while preserving the interactive elements and their ancestor chains.
 *
 * Example DOM structure and inert application:
 *
 * Before calling isolateInteractions:
 * ```
 * <body>
 *   <header>...</header>
 *   <main>
 *     <div>
 *       <span>some content</span>
 *       <div class="modal">modal content</div>
 *       <span>more content</span>
 *     </div>
 *     <aside inert>already inert</aside>
 *     <div class="dropdown">dropdown menu</div>
 *   </main>
 *   <footer>...</footer>
 * </body>
 * ```
 *
 * After calling isolateInteractions([modal, dropdown]):
 * ```
 * <body>
 *   <header inert>...</header>  ← made inert (no active descendants)
 *   <main> ← not inert because it contains active elements
 *     <div> ← not inert because it contains .modal
 *       <span inert>some content</span> ← made inert selectively
 *       <div class="modal">modal content</div> ← stays active
 *       <span inert>more content</span> ← made inert selectively
 *     </div>
 *     <aside inert>already inert</aside>
 *     <div class="dropdown">dropdown menu</div> ← stays active
 *   </main>
 *   <footer inert>...</footer>
 * </body>
 * ```
 *
 * After calling cleanup():
 * ```
 * <body>
 *   <header>...</header>
 *   <main>
 *     <div>
 *       <span>some content</span>
 *       <div class="modal">modal content</div>
 *       <span>more content</span>
 *     </div>
 *     <aside inert>already inert</aside> ← [inert] preserved
 *     <div class="dropdown">dropdown menu</div>
 *   </main>
 *   <footer>...</footer>
 * </body>
 * ```
 *
 * @param {Array<Element>} elements - Array of elements to keep interactive (non-inert)
 * @returns {Function} cleanup - Function to restore original inert states
 */
const isolateInteractions = (elements) => {
  const cleanupCallbackSet = new Set();
  const cleanup = () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };

  const toKeepInteractiveSet = new Set();
  const keepSelfAndAncestors = (el) => {
    if (toKeepInteractiveSet.has(el)) {
      return;
    }
    const associatedElements = getAssociatedElements(el);
    if (associatedElements) {
      for (const associatedElement of associatedElements) {
        keepSelfAndAncestors(associatedElement);
      }
    }

    // Add the element itself
    toKeepInteractiveSet.add(el);
    // Add all its ancestors up to document.body
    let ancestor = el.parentNode;
    while (ancestor && ancestor !== document.body) {
      toKeepInteractiveSet.add(ancestor);
      ancestor = ancestor.parentNode;
    }
  };

  // Build set of elements to keep interactive
  for (const element of elements) {
    keepSelfAndAncestors(element);
  }
  // backdrop elements are meant to control interactions happening at document level
  // and should stay interactive
  const backdropElements = document.querySelectorAll("[data-backdrop]");
  for (const backdropElement of backdropElements) {
    keepSelfAndAncestors(backdropElement);
  }

  const setInert = (el) => {
    if (toKeepInteractiveSet.has(el)) {
      // element should stay interactive
      return;
    }
    const restoreAttributes = setAttributes(el, {
      inert: "",
    });
    cleanupCallbackSet.add(() => {
      restoreAttributes();
    });
  };

  const makeElementInertSelectivelyOrCompletely = (el) => {
    // If this element should stay interactive, keep it active
    if (toKeepInteractiveSet.has(el)) {
      return;
    }

    // Since we put all ancestors in toKeepInteractiveSet, if this element
    // is not in the set, we can check if any of its direct children are.
    // If none of the direct children are in the set, then no descendants are either.
    const children = Array.from(el.children);
    const hasInteractiveChildren = children.some((child) =>
      toKeepInteractiveSet.has(child),
    );

    if (!hasInteractiveChildren) {
      // No interactive descendants, make the entire element inert
      setInert(el);
      return;
    }

    // Some children need to stay interactive, process them selectively
    for (const child of children) {
      makeElementInertSelectivelyOrCompletely(child);
    }
  };

  // Apply inert to all top-level elements that aren't in our keep-interactive set
  const bodyChildren = Array.from(document.body.children);
  for (const child of bodyChildren) {
    makeElementInertSelectivelyOrCompletely(child);
  }

  return () => {
    cleanup();
  };
};

installImportMetaCss(import.meta);
const createDragGestureController = (options = {}) => {
  const {
    name,
    onGrab,
    onDragStart,
    onDrag,
    onRelease,
    threshold = 5,
    direction: defaultDirection = { x: true, y: true },
    documentInteractions = "auto",
    backdrop = true,
    backdropZIndex = 999999,
  } = options;

  const dragGestureController = {
    grab: null,
    gravViaPointer: null,
  };

  const grab = ({
    element,
    direction = defaultDirection,
    event = new CustomEvent("programmatic"),
    grabX = 0,
    grabY = 0,
    cursor = "grabbing",
    scrollContainer = document.documentElement,
    layoutScrollableLeft: scrollableLeftAtGrab = 0,
    layoutScrollableTop: scrollableTopAtGrab = 0,
  } = {}) => {
    if (!element) {
      throw new Error("element is required");
    }
    if (!direction.x && !direction.y) {
      return null;
    }

    const [publishBeforeDrag, addBeforeDragCallback] = createPubSub();
    const [publishDrag, addDragCallback] = createPubSub();
    const [publishRelease, addReleaseCallback] = createPubSub();
    if (onDrag) {
      addDragCallback(onDrag);
    }
    if (onRelease) {
      addReleaseCallback(onRelease);
    }

    const scrollLeftAtGrab = scrollContainer.scrollLeft;
    const scrollTopAtGrab = scrollContainer.scrollTop;
    const leftAtGrab = scrollLeftAtGrab + scrollableLeftAtGrab;
    const topAtGrab = scrollTopAtGrab + scrollableTopAtGrab;
    const createLayout = (x, y) => {
      const { scrollLeft, scrollTop } = scrollContainer;
      const left = scrollableLeftAtGrab + x;
      const top = scrollableTopAtGrab + y;
      const scrollableLeft = left - scrollLeft;
      const scrollableTop = top - scrollTop;
      const layoutProps = {
        // Raw input coordinates (dragX - grabX + scrollContainer.scrollLeft)
        x,
        y,
        // container scrolls when layout is created
        scrollLeft,
        scrollTop,
        // Position relative to container excluding scrolls
        scrollableLeft,
        scrollableTop,
        // Position relative to container including scrolls
        left,
        top,
        // Delta since grab (number representing how much we dragged)
        xDelta: left - leftAtGrab,
        yDelta: top - topAtGrab,
      };
      return layoutProps;
    };

    const grabLayout = createLayout(
      grabX + scrollContainer.scrollLeft,
      grabY + scrollContainer.scrollTop,
    );
    const gestureInfo = {
      name,
      direction,
      started: !threshold,
      status: "grabbed",

      element,
      scrollContainer,
      grabX, // x grab coordinate (excluding scroll)
      grabY, // y grab coordinate (excluding scroll)
      grabLayout,
      leftAtGrab,
      topAtGrab,

      dragX: grabX, // coordinate of the last drag (excluding scroll of the scrollContainer)
      dragY: grabY, // coordinate of the last drag (excluding scroll of the scrollContainer)
      layout: grabLayout,

      isGoingUp: undefined,
      isGoingDown: undefined,
      isGoingLeft: undefined,
      isGoingRight: undefined,

      // metadata about interaction sources
      grabEvent: event,
      dragEvent: null,
      releaseEvent: null,
    };
    definePropertyAsReadOnly(gestureInfo, "name");
    definePropertyAsReadOnly(gestureInfo, "direction");
    definePropertyAsReadOnly(gestureInfo, "scrollContainer");
    definePropertyAsReadOnly(gestureInfo, "grabX");
    definePropertyAsReadOnly(gestureInfo, "grabY");
    definePropertyAsReadOnly(gestureInfo, "grabLayout");
    definePropertyAsReadOnly(gestureInfo, "leftAtGrab");
    definePropertyAsReadOnly(gestureInfo, "topAtGrab");
    definePropertyAsReadOnly(gestureInfo, "grabEvent");

    document_interactions: {
      if (documentInteractions === "manual") {
        break document_interactions;
      }
      /*
      GOAL: Take control of document-level interactions during drag gestures
      
      WHY: During drag operations, we need to prevent conflicting user interactions that would:
      1. Interfere with the drag gesture (competing pointer events, focus changes)
      2. Break the visual feedback (inconsistent cursors, hover states)
      3. Cause unwanted scrolling (keyboard shortcuts, wheel events in restricted directions)
      4. Create accessibility issues (focus jumping, screen reader confusion)

      STRATEGY: Create a controlled interaction environment by:
      1. VISUAL CONTROL: Use a backdrop to unify cursor appearance and block pointer events
      2. INTERACTION ISOLATION: Make non-dragged elements inert to prevent interference
      3. FOCUS MANAGEMENT: Control focus location and prevent focus changes during drag
      4. SELECTIVE SCROLLING: Allow scrolling only in directions supported by the drag gesture

      IMPLEMENTATION:
      */

      // 1. INTERACTION ISOLATION: Make everything except the dragged element inert
      // This prevents keyboard events, pointer interactions, and screen reader navigation
      // on non-relevant elements during the drag operation
      const cleanupInert = isolateInteractions([
        element,
        ...Array.from(document.querySelectorAll("[data-droppable]")),
      ]);
      addReleaseCallback(() => {
        cleanupInert();
      });

      // 2. VISUAL CONTROL: Backdrop for consistent cursor and pointer event blocking
      if (backdrop) {
        const backdropElement = document.createElement("div");
        backdropElement.className = "navi_drag_gesture_backdrop";
        backdropElement.ariaHidden = "true";
        backdropElement.setAttribute("data-backdrop", "");
        backdropElement.style.zIndex = backdropZIndex;
        backdropElement.style.cursor = cursor;

        // Handle wheel events on backdrop for directionally-constrained drag gestures
        // (e.g., table column resize should only allow horizontal scrolling)
        if (!direction.x || !direction.y) {
          backdropElement.onwheel = (e) => {
            e.preventDefault();
            const scrollX = direction.x ? e.deltaX : 0;
            const scrollY = direction.y ? e.deltaY : 0;
            scrollContainer.scrollBy({
              left: scrollX,
              top: scrollY,
              behavior: "auto",
            });
          };
        }
        document.body.appendChild(backdropElement);
        addReleaseCallback(() => {
          backdropElement.remove();
        });
      }

      // 3. FOCUS MANAGEMENT: Control and stabilize focus during drag
      const { activeElement } = document;
      const focusableElement = findFocusable(element);
      // Focus the dragged element (or document.body as fallback) to establish clear focus context
      // This also ensure any keydown event listened by the currently focused element
      // won't be available during drag
      const elementToFocus = focusableElement || document.body;
      elementToFocus.focus({
        preventScroll: true,
      });
      addReleaseCallback(() => {
        // Restore original focus on release
        activeElement.focus({
          preventScroll: true,
        });
      });
      // Prevent Tab navigation entirely (focus should stay stable)
      const onkeydown = (e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          return;
        }
      };
      document.addEventListener("keydown", onkeydown);
      addReleaseCallback(() => {
        document.removeEventListener("keydown", onkeydown);
      });

      // 4. SELECTIVE SCROLLING: Allow keyboard scrolling only in supported directions
      {
        const onDocumentKeydown = (keyboardEvent) => {
          // Vertical scrolling keys - prevent if vertical movement not supported
          if (
            keyboardEvent.key === "ArrowUp" ||
            keyboardEvent.key === "ArrowDown" ||
            keyboardEvent.key === " " ||
            keyboardEvent.key === "PageUp" ||
            keyboardEvent.key === "PageDown" ||
            keyboardEvent.key === "Home" ||
            keyboardEvent.key === "End"
          ) {
            if (!direction.y) {
              keyboardEvent.preventDefault();
            }
            return;
          }
          // Horizontal scrolling keys - prevent if horizontal movement not supported
          if (
            keyboardEvent.key === "ArrowLeft" ||
            keyboardEvent.key === "ArrowRight"
          ) {
            if (!direction.x) {
              keyboardEvent.preventDefault();
            }
            return;
          }
        };
        document.addEventListener("keydown", onDocumentKeydown);
        addReleaseCallback(() => {
          document.removeEventListener("keydown", onDocumentKeydown);
        });
      }
    }

    // Set up scroll event handling to adjust drag position when scrolling occurs
    {
      let isHandlingScroll = false;
      const handleScroll = (scrollEvent) => {
        if (isHandlingScroll) {
          return;
        }
        isHandlingScroll = true;
        drag(gestureInfo.dragX, gestureInfo.dragY, { event: scrollEvent });
        isHandlingScroll = false;
      };
      const scrollEventReceiver =
        scrollContainer === document.documentElement
          ? document
          : scrollContainer;
      scrollEventReceiver.addEventListener("scroll", handleScroll, {
        passive: true,
      });
      addReleaseCallback(() => {
        scrollEventReceiver.removeEventListener("scroll", handleScroll, {
          passive: true,
        });
      });
    }

    const determineDragData = ({
      dragX,
      dragY,
      dragEvent,
      isRelease = false,
    }) => {
      // === ÉTAT INITIAL (au moment du grab) ===
      const { grabX, grabY, grabLayout } = gestureInfo;
      // === CE QUI EST DEMANDÉ (où on veut aller) ===
      // Calcul de la direction basé sur le mouvement précédent
      // (ne tient pas compte du mouvement final une fois les contraintes appliquées)
      // (ici on veut connaitre l'intention)
      // on va utiliser cela pour savoir vers où on scroll si nécéssaire par ex
      const currentDragX = gestureInfo.dragX;
      const currentDragY = gestureInfo.dragY;
      const isGoingLeft = dragX < currentDragX;
      const isGoingRight = dragX > currentDragX;
      const isGoingUp = dragY < currentDragY;
      const isGoingDown = dragY > currentDragY;

      const layoutXRequested = direction.x
        ? scrollContainer.scrollLeft + (dragX - grabX)
        : grabLayout.scrollLeft;
      const layoutYRequested = direction.y
        ? scrollContainer.scrollTop + (dragY - grabY)
        : grabLayout.scrollTop;
      const layoutRequested = createLayout(layoutXRequested, layoutYRequested);
      const currentLayout = gestureInfo.layout;
      let layout;
      if (
        layoutRequested.x === currentLayout.x &&
        layoutRequested.y === currentLayout.y
      ) {
        layout = currentLayout;
      } else {
        // === APPLICATION DES CONTRAINTES ===
        let layoutConstrained = layoutRequested;
        const limitLayout = (left, top) => {
          layoutConstrained = createLayout(
            left === undefined
              ? layoutConstrained.x
              : left - scrollableLeftAtGrab,
            top === undefined ? layoutConstrained.y : top - scrollableTopAtGrab,
          );
        };

        publishBeforeDrag(layoutRequested, currentLayout, limitLayout, {
          dragEvent,
          isRelease,
        });
        // === ÉTAT FINAL ===
        layout = layoutConstrained;
      }

      const dragData = {
        dragX,
        dragY,
        layout,

        isGoingLeft,
        isGoingRight,
        isGoingUp,
        isGoingDown,

        status: isRelease ? "released" : "dragging",
        dragEvent: isRelease ? gestureInfo.dragEvent : dragEvent,
        releaseEvent: isRelease ? dragEvent : null,
      };

      if (isRelease) {
        return dragData;
      }
      if (!gestureInfo.started && threshold) {
        const deltaX = Math.abs(dragX - grabX);
        const deltaY = Math.abs(dragY - grabY);
        if (direction.x && direction.y) {
          // Both directions: check both axes
          if (deltaX < threshold && deltaY < threshold) {
            return dragData;
          }
        } else if (direction.x) {
          if (deltaX < threshold) {
            return dragData;
          }
        } else if (direction.y) {
          if (deltaY < threshold) {
            return dragData;
          }
        }
        dragData.started = true;
      }
      return dragData;
    };

    const drag = (
      dragX = gestureInfo.dragX, // Scroll container relative X coordinate
      dragY = gestureInfo.dragY, // Scroll container relative Y coordinate
      { event = new CustomEvent("programmatic"), isRelease = false } = {},
    ) => {

      const dragData = determineDragData({
        dragX,
        dragY,
        dragEvent: event,
        isRelease,
      });
      const startedPrevious = gestureInfo.started;
      const layoutPrevious = gestureInfo.layout;
      // previousGestureInfo = { ...gestureInfo };
      Object.assign(gestureInfo, dragData);
      if (!startedPrevious && gestureInfo.started) {
        onDragStart?.(gestureInfo);
      }
      const someLayoutChange = gestureInfo.layout !== layoutPrevious;
      publishDrag(
        gestureInfo,
        // we still publish drag event even when unchanged
        // because UI might need to adjust when document scrolls
        // even if nothing truly changes visually the element
        // can decide to stick to the scroll for example
        someLayoutChange,
      );
    };

    const release = ({
      event = new CustomEvent("programmatic"),
      releaseX = gestureInfo.dragX,
      releaseY = gestureInfo.dragY,
    } = {}) => {
      drag(releaseX, releaseY, { event, isRelease: true });
      publishRelease(gestureInfo);
    };

    onGrab?.(gestureInfo);
    const dragGesture = {
      gestureInfo,
      addBeforeDragCallback,
      addDragCallback,
      addReleaseCallback,
      drag,
      release,
    };
    return dragGesture;
  };
  dragGestureController.grab = grab;

  const initDragByPointer = (grabEvent, dragOptions, initializer) => {
    if (grabEvent.button !== undefined && grabEvent.button !== 0) {
      return null;
    }
    const target = grabEvent.target;
    if (!target.closest) {
      // target is a text node
      return null;
    }
    const mouseEventCoords = (mouseEvent) => {
      const { clientX, clientY } = mouseEvent;
      return [clientX, clientY];
    };
    const [grabX, grabY] = mouseEventCoords(grabEvent);
    const dragGesture = dragGestureController.grab({
      grabX,
      grabY,
      event: grabEvent,
      ...dragOptions,
    });
    const dragViaPointer = (dragEvent) => {
      const [mouseDragX, mouseDragY] = mouseEventCoords(dragEvent);
      dragGesture.drag(mouseDragX, mouseDragY, {
        event: dragEvent,
      });
    };
    const releaseViaPointer = (mouseupEvent) => {
      const [mouseReleaseX, mouseReleaseY] = mouseEventCoords(mouseupEvent);
      dragGesture.release({
        event: mouseupEvent,
        releaseX: mouseReleaseX,
        releaseY: mouseReleaseY,
      });
    };
    dragGesture.dragViaPointer = dragViaPointer;
    dragGesture.releaseViaPointer = releaseViaPointer;
    const cleanup = initializer({
      onMove: dragViaPointer,
      onRelease: releaseViaPointer,
    });
    dragGesture.addReleaseCallback(() => {
      cleanup();
    });
    return dragGesture;
  };

  const grabViaPointer = (grabEvent, options) => {
    if (grabEvent.type === "pointerdown") {
      return initDragByPointer(grabEvent, options, ({ onMove, onRelease }) => {
        const target = grabEvent.target;
        target.setPointerCapture(grabEvent.pointerId);
        target.addEventListener("lostpointercapture", onRelease);
        target.addEventListener("pointercancel", onRelease);
        target.addEventListener("pointermove", onMove);
        target.addEventListener("pointerup", onRelease);
        return () => {
          target.releasePointerCapture(grabEvent.pointerId);
          target.removeEventListener("lostpointercapture", onRelease);
          target.removeEventListener("pointercancel", onRelease);
          target.removeEventListener("pointermove", onMove);
          target.removeEventListener("pointerup", onRelease);
        };
      });
    }
    if (grabEvent.type === "mousedown") {
      console.warn(
        `Received "mousedown" event, "pointerdown" events are recommended to perform drag gestures.`,
      );
      return initDragByPointer(grabEvent, options, ({ onMove, onRelease }) => {
        const onPointerUp = (pointerEvent) => {
          // <button disabled> for example does not emit mouseup if we release mouse over it
          // -> we add "pointerup" to catch mouseup occuring on disabled element
          if (pointerEvent.pointerType === "mouse") {
            onRelease(pointerEvent);
          }
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onRelease);
        document.addEventListener("pointerup", onPointerUp);
        return () => {
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onRelease);
          document.removeEventListener("pointerup", onPointerUp);
        };
      });
    }
    throw new Error(
      `Unsupported "${grabEvent.type}" evenet passed to grabViaPointer. "pointerdown" was expected.`,
    );
  };
  dragGestureController.grabViaPointer = grabViaPointer;

  return dragGestureController;
};

const dragAfterThreshold = (
  grabEvent,
  dragGestureInitializer,
  threshold,
) => {
  const significantDragGestureController = createDragGestureController({
    threshold,
    // allow interaction for this intermediate gesture:
    // user should still be able to scroll or interact with the document
    // only once the gesture is significant we take control
    documentInteractions: "manual",
    onDragStart: (gestureInfo) => {
      significantDragGesture.release(); // kill that gesture
      const dragGesture = dragGestureInitializer();
      dragGesture.dragViaPointer(gestureInfo.dragEvent);
    },
  });
  const significantDragGesture =
    significantDragGestureController.grabViaPointer(grabEvent, {
      element: grabEvent.target,
    });
};

const definePropertyAsReadOnly = (object, propertyName) => {
  Object.defineProperty(object, propertyName, {
    writable: false,
    value: object[propertyName],
  });
};

import.meta.css = /* css */ `
  .navi_drag_gesture_backdrop {
    position: fixed;
    inset: 0;
    user-select: none;
  }
`;

installImportMetaCss(import.meta);const setupConstraintFeedbackLine = () => {
  const constraintFeedbackLine = createConstraintFeedbackLine();

  // Track last known mouse position for constraint feedback line during scroll
  let lastMouseX = null;
  let lastMouseY = null;

  // Internal function to update constraint feedback line
  const onDrag = (gestureInfo) => {
    const { grabEvent, dragEvent } = gestureInfo;
    if (
      grabEvent.type === "programmatic" ||
      dragEvent.type === "programmatic"
    ) {
      // programmatic drag
      return;
    }

    const mouseX = dragEvent.clientX;
    const mouseY = dragEvent.clientY;
    // Use last known position if current position not available (e.g., during scroll)
    const effectiveMouseX = mouseX !== null ? mouseX : lastMouseX;
    const effectiveMouseY = mouseY !== null ? mouseY : lastMouseY;
    if (effectiveMouseX === null || effectiveMouseY === null) {
      return;
    }

    // Store current mouse position for potential use during scroll
    lastMouseX = mouseX;
    lastMouseY = mouseY;

    const grabClientX = grabEvent.clientX;
    const grabClientY = grabEvent.clientY;

    // Calculate distance between mouse and current grab point
    const deltaX = effectiveMouseX - grabClientX;
    const deltaY = effectiveMouseY - grabClientY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    // Show line only when distance is significant (> 20px threshold)
    const threshold = 20;
    if (distance <= threshold) {
      constraintFeedbackLine.style.opacity = "";
      constraintFeedbackLine.removeAttribute("data-visible");
      return;
    }

    // Calculate angle and position
    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
    // Position line at current grab point (follows element movement)
    constraintFeedbackLine.style.left = `${grabClientX}px`;
    constraintFeedbackLine.style.top = `${grabClientY}px`;
    constraintFeedbackLine.style.width = `${distance}px`;
    constraintFeedbackLine.style.transform = `rotate(${angle}deg)`;
    // Fade in based on distance (more visible as distance increases)
    const maxOpacity = 0.8;
    const opacityFactor = Math.min((distance - threshold) / 100, 1);
    constraintFeedbackLine.style.opacity = `${maxOpacity * opacityFactor}`;
    constraintFeedbackLine.setAttribute("data-visible", "");
  };

  return {
    onDrag,
    onRelease: () => {
      constraintFeedbackLine.remove();
    },
  };
};

const createConstraintFeedbackLine = () => {
  const line = document.createElement("div");
  line.className = "navi_constraint_feedback_line";
  line.title =
    "Constraint feedback - shows distance between mouse and moving grab point";
  document.body.appendChild(line);
  return line;
};

import.meta.css = /* css */ `
  .navi_constraint_feedback_line {
    position: fixed;
    pointer-events: none;
    z-index: 9998;
    visibility: hidden;
    transition: opacity 0.15s ease;
    transform-origin: left center;
    border-top: 2px dotted rgba(59, 130, 246, 0.7);
  }

  .navi_constraint_feedback_line[data-visible] {
    visibility: visible;
  }
`;

installImportMetaCss(import.meta);const MARKER_SIZE = 12;

let currentDebugMarkers = [];
let currentConstraintMarkers = [];
let currentReferenceElementMarker = null;
let currentElementMarker = null;

const setupDragDebugMarkers = (dragGesture, { referenceElement }) => {
  // Clean up any existing persistent markers from previous drag gestures
  {
    // Remove any existing markers from previous gestures
    const container = document.getElementById("navi_debug_markers_container");
    if (container) {
      container.innerHTML = ""; // Clear all markers efficiently
    }
  }

  const { direction, scrollContainer } = dragGesture.gestureInfo;

  return {
    onConstraints: (
      constraints,
      { left, top, right, bottom, autoScrollArea },
    ) => {
      // Schedule removal of previous markers if they exist
      const previousDebugMarkers = [...currentDebugMarkers];
      const previousConstraintMarkers = [...currentConstraintMarkers];
      const previousReferenceElementMarker = currentReferenceElementMarker;
      const previousElementMarker = currentElementMarker;

      if (
        previousDebugMarkers.length > 0 ||
        previousConstraintMarkers.length > 0 ||
        previousReferenceElementMarker ||
        previousElementMarker
      ) {
        setTimeout(() => {
          previousDebugMarkers.forEach((marker) => marker.remove());
          previousConstraintMarkers.forEach((marker) => marker.remove());
          if (previousReferenceElementMarker) {
            previousReferenceElementMarker.remove();
          }
          if (previousElementMarker) {
            previousElementMarker.remove();
          }
        }, 100);
      }

      // Clear current marker arrays
      currentDebugMarkers.length = 0;
      currentConstraintMarkers.length = 0;
      currentReferenceElementMarker = null;
      currentElementMarker = null;

      // Create element marker (always show the dragged element)
      // When there's a reference element, show it as "Dragged Element"
      // When there's no reference element, show it as "Element"
      const elementLabel = referenceElement ? "Dragged Element" : "Element";
      const elementColor = referenceElement ? "255, 0, 150" : "0, 200, 0"; // Pink when with reference, green when standalone

      currentElementMarker = createElementMarker({
        left,
        top,
        right,
        bottom,
        scrollContainer,
        label: elementLabel,
        color: elementColor,
      });

      // Create reference element marker if reference element exists
      if (referenceElement) {
        currentReferenceElementMarker = createReferenceElementMarker({
          left,
          top,
          right,
          bottom,
          scrollContainer,
        });
      }

      // Collect all markers to be created, then merge duplicates
      const markersToCreate = [];

      {
        if (direction.x) {
          markersToCreate.push({
            name: autoScrollArea.paddingLeft
              ? `autoscroll.left + padding(${autoScrollArea.paddingLeft})`
              : "autoscroll.left",
            x: autoScrollArea.left,
            y: 0,
            color: "0 128 0", // green
            side: "left",
          });
          markersToCreate.push({
            name: autoScrollArea.paddingRight
              ? `autoscroll.right + padding(${autoScrollArea.paddingRight})`
              : "autoscroll.right",
            x: autoScrollArea.right,
            y: 0,
            color: "0 128 0", // green
            side: "right",
          });
        }
        if (direction.y) {
          markersToCreate.push({
            name: autoScrollArea.paddingTop
              ? `autoscroll.top + padding(${autoScrollArea.paddingTop})`
              : "autoscroll.top",
            x: 0,
            y: autoScrollArea.top,
            color: "255 0 0", // red
            side: "top",
          });
          markersToCreate.push({
            name: autoScrollArea.paddingBottom
              ? `autoscroll.bottom + padding(${autoScrollArea.paddingBottom})`
              : "autoscroll.bottom",
            x: 0,
            y: autoScrollArea.bottom,
            color: "255 165 0", // orange
            side: "bottom",
          });
        }
      }

      // Process each constraint individually to preserve names
      for (const constraint of constraints) {
        if (constraint.type === "bounds") {
          const { bounds } = constraint;

          // Create individual markers for each bound with constraint name
          if (direction.x) {
            if (bounds.left !== undefined) {
              markersToCreate.push({
                name: `${constraint.name}.left`,
                x: bounds.left,
                y: 0,
                color: "128 0 128", // purple
                side: "left",
              });
            }
            if (bounds.right !== undefined) {
              // For visual clarity, show rightBound at the right edge of the element
              // when element is positioned at rightBound (not the left edge position)
              markersToCreate.push({
                name: `${constraint.name}.right`,
                x: bounds.right,
                y: 0,
                color: "128 0 128", // purple
                side: "right",
              });
            }
          }
          if (direction.y) {
            if (bounds.top !== undefined) {
              markersToCreate.push({
                name: `${constraint.name}.top`,
                x: 0,
                y: bounds.top,
                color: "128 0 128", // purple
                side: "top",
              });
            }
            if (bounds.bottom !== undefined) {
              // For visual clarity, show bottomBound at the bottom edge of the element
              // when element is positioned at bottomBound (not the left edge position)
              markersToCreate.push({
                name: `${constraint.name}.bottom`,
                x: 0,
                y: bounds.bottom,
                color: "128 0 128", // purple
                side: "bottom",
              });
            }
          }
        } else if (constraint.type === "obstacle") {
          const obstacleMarker = createObstacleMarker(
            constraint,
            scrollContainer,
          );
          currentConstraintMarkers.push(obstacleMarker);
        }
      }

      // Create markers with merging for overlapping positions
      const createdMarkers = createMergedMarkers(
        markersToCreate,
        scrollContainer,
      );
      currentDebugMarkers.push(
        ...createdMarkers.filter((m) => m.type !== "constraint"),
      );
      currentConstraintMarkers.push(
        ...createdMarkers.filter((m) => m.type === "constraint"),
      );
    },
    onRelease: () => {
      {
        return;
      }
    },
  };
};

// Ensure markers container exists and return it
const getMarkersContainer = () => {
  let container = document.getElementById("navi_debug_markers_container");
  if (!container) {
    container = document.createElement("div");
    container.id = "navi_debug_markers_container";
    container.className = "navi_debug_markers_container";
    document.body.appendChild(container);
  }
  return container;
};

// Convert document-relative coordinates to viewport coordinates for marker positioning
// Takes the scroll container into account for proper positioning relative to the container
const getDebugMarkerPos = (x, y, scrollContainer, side = null) => {
  const { documentElement } = document;

  const leftWithoutScroll = x - scrollContainer.scrollLeft;
  const topWithoutScroll = y - scrollContainer.scrollTop;
  let baseX;
  let baseY;
  if (scrollContainer === documentElement) {
    // our markers are injected into the document so we have the right coordinates already
    // and we remove scroll because our markers are in a fixed position ancestor (to ensure they cannot influence scrollbars)
    baseX = leftWithoutScroll;
    baseY = topWithoutScroll;
  } else {
    // we need to remove the scroll of the container?
    // not sure I think here we might want to keep the scroll container scroll
    // and that's it
    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    baseX = scrollContainerRect.left + leftWithoutScroll;
    baseY = scrollContainerRect.top + topWithoutScroll;
  }

  // Apply side-specific logic for extending markers across viewport
  if (side === "left" || side === "right") {
    // Vertical markers: x should stay fixed in viewport, y can extend
    return [baseX, 0]; // y=0 to start from top of viewport
  }
  if (side === "top" || side === "bottom") {
    // Horizontal markers: y should stay fixed in viewport, x can extend
    return [0, baseY]; // x=0 to start from left of viewport
  }

  // For obstacles and other markers: use converted coordinates directly
  return [baseX, baseY];
};

const createMergedMarkers = (markersToCreate, scrollContainer) => {
  const mergedMarkers = [];
  const positionMap = new Map();

  // Group markers by position and side
  for (const marker of markersToCreate) {
    const key = `${marker.x},${marker.y},${marker.side}`;

    if (!positionMap.has(key)) {
      positionMap.set(key, []);
    }
    positionMap.get(key).push(marker);
  }

  // Create markers with merged labels for overlapping positions
  for (const [, markers] of positionMap) {
    if (markers.length === 1) {
      // Single marker - create as normal
      const marker = markers[0];
      const domMarker = createDebugMarker(marker, scrollContainer);
      domMarker.type = marker.name.includes("Bound") ? "constraint" : "visible";
      mergedMarkers.push(domMarker);
    } else {
      // Multiple markers at same position - merge labels
      const firstMarker = markers[0];
      const combinedName = markers.map((m) => m.name).join(" + ");

      // Use the first marker's color, or mix colors if needed
      const domMarker = createDebugMarker(
        {
          ...firstMarker,
          name: combinedName,
        },
        scrollContainer,
      );
      domMarker.type = markers.some((m) => m.name.includes("Bound"))
        ? "constraint"
        : "visible";
      mergedMarkers.push(domMarker);
    }
  }

  return mergedMarkers;
};

const createDebugMarker = (
  { name, x, y, color = "255 0 0", side },
  scrollContainer,
) => {
  // Convert coordinates from document-relative to viewport
  const [viewportX, viewportY] = getDebugMarkerPos(x, y, scrollContainer, side);

  const marker = document.createElement("div");
  marker.className = `navi_debug_marker`;
  marker.setAttribute(`data-${side}`, "");
  // Set the color as a CSS custom property
  marker.style.setProperty("--marker-color", `rgb(${color})`);
  // Position markers exactly at the boundary coordinates
  marker.style.left =
    side === "right" ? `${viewportX - MARKER_SIZE}px` : `${viewportX}px`;
  marker.style.top =
    side === "bottom" ? `${viewportY - MARKER_SIZE}px` : `${viewportY}px`;
  marker.title = name;

  // Add label
  const label = document.createElement("div");
  label.className = `navi_debug_marker_label`;
  label.textContent = name;
  marker.appendChild(label);

  const container = getMarkersContainer();
  container.appendChild(marker);
  return marker;
};
const createObstacleMarker = (obstacleObj, scrollContainer) => {
  const width = obstacleObj.bounds.right - obstacleObj.bounds.left;
  const height = obstacleObj.bounds.bottom - obstacleObj.bounds.top;

  // Convert document-relative coordinates to viewport coordinates
  const [x, y] = getDebugMarkerPos(
    obstacleObj.bounds.left,
    obstacleObj.bounds.top,
    scrollContainer,
    "obstacle",
  );

  const marker = document.createElement("div");
  marker.className = "navi_obstacle_marker";
  marker.style.left = `${x}px`;
  marker.style.top = `${y}px`;
  marker.style.width = `${width}px`;
  marker.style.height = `${height}px`;
  marker.title = obstacleObj.name;

  // Add label
  const label = document.createElement("div");
  label.className = "navi_obstacle_marker_label";
  label.textContent = obstacleObj.name;
  marker.appendChild(label);

  const container = getMarkersContainer();
  container.appendChild(marker);
  return marker;
};

const createElementMarker = ({
  left,
  top,
  right,
  bottom,
  scrollContainer,
  label = "Element",
  color = "0, 200, 0", // Default green color
}) => {
  const width = right - left;
  const height = bottom - top;
  // Convert document-relative coordinates to viewport coordinates
  const [x, y] = getDebugMarkerPos(left, top, scrollContainer, "element");

  const marker = document.createElement("div");
  marker.className = "navi_element_marker";
  marker.style.left = `${x}px`;
  marker.style.top = `${y}px`;
  marker.style.width = `${width}px`;
  marker.style.height = `${height}px`;
  marker.title = label;

  // Set the color as CSS custom properties
  marker.style.setProperty("--element-color", `rgb(${color})`);
  marker.style.setProperty("--element-color-alpha", `rgba(${color}, 0.3)`);

  // Add label
  const labelEl = document.createElement("div");
  labelEl.className = "navi_element_marker_label";
  labelEl.textContent = label;
  marker.appendChild(labelEl);

  const container = getMarkersContainer();
  container.appendChild(marker);
  return marker;
};

const createReferenceElementMarker = ({
  left,
  top,
  right,
  bottom,
  scrollContainer,
}) => {
  const width = right - left;
  const height = bottom - top;
  // Convert document-relative coordinates to viewport coordinates
  const [x, y] = getDebugMarkerPos(left, top, scrollContainer, "reference");

  const marker = document.createElement("div");
  marker.className = "navi_reference_element_marker";
  marker.style.left = `${x}px`;
  marker.style.top = `${y}px`;
  marker.style.width = `${width}px`;
  marker.style.height = `${height}px`;
  marker.title = "Reference Element";

  // Add label
  const label = document.createElement("div");
  label.className = "navi_reference_element_marker_label";
  label.textContent = "Reference Element";
  marker.appendChild(label);

  const container = getMarkersContainer();
  container.appendChild(marker);
  return marker;
};

import.meta.css = /* css */ `
  .navi_debug_markers_container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    pointer-events: none;
    z-index: 999998;
    --marker-size: ${MARKER_SIZE}px;
  }

  .navi_debug_marker {
    position: absolute;
    pointer-events: none;
  }

  /* Markers based on side rather than orientation */
  .navi_debug_marker[data-left],
  .navi_debug_marker[data-right] {
    width: var(--marker-size);
    height: 100vh;
  }

  .navi_debug_marker[data-top],
  .navi_debug_marker[data-bottom] {
    width: 100vw;
    height: var(--marker-size);
  }

  /* Gradient directions based on side, using CSS custom properties for color */
  .navi_debug_marker[data-left] {
    background: linear-gradient(
      to right,
      rgba(from var(--marker-color) r g b / 0.9) 0%,
      rgba(from var(--marker-color) r g b / 0.7) 30%,
      rgba(from var(--marker-color) r g b / 0.3) 70%,
      rgba(from var(--marker-color) r g b / 0) 100%
    );
  }

  .navi_debug_marker[data-right] {
    background: linear-gradient(
      to left,
      rgba(from var(--marker-color) r g b / 0.9) 0%,
      rgba(from var(--marker-color) r g b / 0.7) 30%,
      rgba(from var(--marker-color) r g b / 0.3) 70%,
      rgba(from var(--marker-color) r g b / 0) 100%
    );
  }

  .navi_debug_marker[data-top] {
    background: linear-gradient(
      to bottom,
      rgba(from var(--marker-color) r g b / 0.9) 0%,
      rgba(from var(--marker-color) r g b / 0.7) 30%,
      rgba(from var(--marker-color) r g b / 0.3) 70%,
      rgba(from var(--marker-color) r g b / 0) 100%
    );
  }

  .navi_debug_marker[data-bottom] {
    background: linear-gradient(
      to top,
      rgba(from var(--marker-color) r g b / 0.9) 0%,
      rgba(from var(--marker-color) r g b / 0.7) 30%,
      rgba(from var(--marker-color) r g b / 0.3) 70%,
      rgba(from var(--marker-color) r g b / 0) 100%
    );
  }

  .navi_debug_marker_label {
    position: absolute;
    font-size: 12px;
    font-weight: bold;
    background: rgba(255, 255, 255, 0.9);
    padding: 2px 6px;
    border-radius: 3px;
    border: 1px solid;
    white-space: nowrap;
    pointer-events: none;
    color: rgb(from var(--marker-color) r g b / 1);
    border-color: rgb(from var(--marker-color) r g b / 1);
  }

  /* Label positioning based on side data attributes */

  /* Left side markers - vertical with 90° rotation */
  .navi_debug_marker[data-left] .navi_debug_marker_label {
    left: 10px;
    top: 20px;
    transform: rotate(90deg);
    transform-origin: left center;
  }

  /* Right side markers - vertical with -90° rotation */
  .navi_debug_marker[data-right] .navi_debug_marker_label {
    right: 10px;
    left: auto;
    top: 20px;
    transform: rotate(-90deg);
    transform-origin: right center;
  }

  /* Top side markers - horizontal, label on the line */
  .navi_debug_marker[data-top] .navi_debug_marker_label {
    top: 0px;
    left: 20px;
  }

  /* Bottom side markers - horizontal, label on the line */
  .navi_debug_marker[data-bottom] .navi_debug_marker_label {
    bottom: 0px;
    top: auto;
    left: 20px;
  }

  .navi_obstacle_marker {
    position: absolute;
    background-color: orange;
    opacity: 0.6;
    z-index: 9999;
    pointer-events: none;
  }

  .navi_obstacle_marker_label {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 12px;
    font-weight: bold;
    color: white;
    text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.8);
    pointer-events: none;
  }

  .navi_element_marker {
    position: absolute;
    background-color: var(--element-color-alpha, rgba(255, 0, 150, 0.3));
    border: 2px solid var(--element-color, rgb(255, 0, 150));
    opacity: 0.9;
    z-index: 9997;
    pointer-events: none;
  }

  .navi_element_marker_label {
    position: absolute;
    top: -25px;
    right: 0;
    font-size: 11px;
    font-weight: bold;
    color: var(--element-color, rgb(255, 0, 150));
    background: rgba(255, 255, 255, 0.9);
    padding: 2px 6px;
    border-radius: 3px;
    border: 1px solid var(--element-color, rgb(255, 0, 150));
    white-space: nowrap;
    pointer-events: none;
  }

  .navi_reference_element_marker {
    position: absolute;
    background-color: rgba(0, 150, 255, 0.3);
    border: 2px dashed rgba(0, 150, 255, 0.7);
    opacity: 0.8;
    z-index: 9998;
    pointer-events: none;
  }

  .navi_reference_element_marker_label {
    position: absolute;
    top: -25px;
    left: 0;
    font-size: 11px;
    font-weight: bold;
    color: rgba(0, 150, 255, 1);
    background: rgba(255, 255, 255, 0.9);
    padding: 2px 6px;
    border-radius: 3px;
    border: 1px solid rgba(0, 150, 255, 0.7);
    white-space: nowrap;
    pointer-events: none;
  }
`;

const initDragConstraints = (
  dragGesture,
  {
    areaConstraint,
    obstaclesContainer,
    obstacleAttributeName,
    showConstraintFeedbackLine,
    showDebugMarkers,
    referenceElement,
  },
) => {
  const dragGestureName = dragGesture.gestureInfo.name;
  const direction = dragGesture.gestureInfo.direction;
  const scrollContainer = dragGesture.gestureInfo.scrollContainer;
  const leftAtGrab = dragGesture.gestureInfo.leftAtGrab;
  const topAtGrab = dragGesture.gestureInfo.topAtGrab;

  const constraintFunctions = [];
  const addConstraint = (constraint) => {
    constraintFunctions.push(constraint);
  };

  if (showConstraintFeedbackLine) {
    const constraintFeedbackLine = setupConstraintFeedbackLine();
    dragGesture.addDragCallback((gestureInfo) => {
      constraintFeedbackLine.onDrag(gestureInfo);
    });
    dragGesture.addReleaseCallback(() => {
      constraintFeedbackLine.onRelease();
    });
  }
  let dragDebugMarkers;
  if (showDebugMarkers) {
    dragDebugMarkers = setupDragDebugMarkers(dragGesture, {
      referenceElement,
    });
    dragGesture.addReleaseCallback(() => {
      dragDebugMarkers.onRelease();
    });
  }

  {
    const areaConstraintFunction = createAreaConstraint(areaConstraint, {
      scrollContainer,
    });
    if (areaConstraintFunction) {
      addConstraint(areaConstraintFunction);
    }
  }
  obstacles: {
    if (!obstacleAttributeName || !obstaclesContainer) {
      break obstacles;
    }
    const obstacleConstraintFunctions =
      createObstacleConstraintsFromQuerySelector(obstaclesContainer, {
        obstacleAttributeName,
        gestureInfo: dragGesture.gestureInfo,
        isDraggedElementSticky: false,
        // isStickyLeftOrHasStickyLeftAttr || isStickyTopOrHasStickyTopAttr,
      });
    for (const obstacleConstraintFunction of obstacleConstraintFunctions) {
      addConstraint(obstacleConstraintFunction);
    }
  }

  const applyConstraints = (
    layoutRequested,
    currentLayout,
    limitLayout,
    {
      elementWidth,
      elementHeight,
      scrollArea,
      scrollport,
      hasCrossedScrollportLeftOnce,
      hasCrossedScrollportTopOnce,
      autoScrollArea,
      dragEvent,
    },
  ) => {
    if (constraintFunctions.length === 0) {
      return;
    }

    const elementCurrentLeft = currentLayout.left;
    const elementCurrentTop = currentLayout.top;
    const elementLeftRequested = layoutRequested.left;
    const elementTopRequested = layoutRequested.top;
    let elementLeft = elementLeftRequested;
    let elementTop = elementTopRequested;

    const constraintInitParams = {
      leftAtGrab,
      topAtGrab,
      left: elementCurrentLeft,
      top: elementCurrentTop,
      right: elementCurrentLeft + elementWidth,
      bottom: elementCurrentTop + elementHeight,
      width: elementWidth,
      height: elementHeight,
      scrollContainer,
      scrollArea,
      scrollport,
      autoScrollArea,
      dragGestureName,
      dragEvent,
    };
    const constraints = constraintFunctions.map((fn) =>
      fn(constraintInitParams),
    );

    const logConstraintEnforcement = (axis, constraint) => {
      if (constraint.type === "obstacle") {
        return;
      }
      const requested =
        axis === "x" ? elementLeftRequested : elementTopRequested;
      const constrained = axis === "x" ? elementLeft : elementTop;
      const action = constrained > requested ? "increased" : "capped";
      const property = axis === "x" ? "left" : "top";
      console.debug(
        `Drag by ${dragEvent.type}: ${property} ${action} from ${requested.toFixed(2)} to ${constrained.toFixed(2)} by ${constraint.type}:${constraint.name}`,
        constraint.element,
      );
    };

    // Apply each constraint in sequence, accumulating their effects
    // This allows multiple constraints to work together (e.g., bounds + obstacles)
    for (const constraint of constraints) {
      const result = constraint.apply({
        // each constraint works with scroll included coordinates
        // and coordinates we provide here includes the scroll of the container
        left: elementLeft,
        top: elementTop,
        right: elementLeft + elementWidth,
        bottom: elementTop + elementHeight,
        width: elementWidth,
        height: elementHeight,
        currentLeft: elementCurrentLeft,
        currentTop: elementCurrentTop,
        scrollport,
        hasCrossedScrollportLeftOnce,
        hasCrossedScrollportTopOnce,
      });
      if (!result) {
        continue;
      }
      const [elementLeftConstrained, elementTopConstrained] = result;
      if (direction.x && elementLeftConstrained !== elementLeft) {
        elementLeft = elementLeftConstrained;
        logConstraintEnforcement("x", constraint);
      }
      if (direction.y && elementTopConstrained !== elementTop) {
        elementTop = elementTopConstrained;
        logConstraintEnforcement("y", constraint);
      }
    }

    if (dragDebugMarkers) {
      dragDebugMarkers.onConstraints(constraints, {
        left: elementLeft,
        top: elementTop,
        right: elementLeft + elementWidth,
        bottom: elementTop + elementHeight,
        elementWidth,
        elementHeight,
        scrollport,
        autoScrollArea,
      });
    }

    const leftModified = elementLeft !== elementLeftRequested;
    const topModified = elementTop !== elementTopRequested;
    if (!leftModified && !topModified) {
      {
        console.debug(
          `Drag by ${dragEvent.type}: no constraint enforcement needed (${elementLeftRequested.toFixed(2)}, ${elementTopRequested.toFixed(2)})`,
        );
      }
      return;
    }

    limitLayout(elementLeft, elementTop);
  };

  return { applyConstraints };
};

const createAreaConstraint = (areaConstraint, { scrollContainer }) => {
  if (!areaConstraint || areaConstraint === "none") {
    return null;
  }
  if (areaConstraint === "scrollport") {
    const scrollportConstraintFunction = ({ scrollport }) => {
      return createBoundConstraint(scrollport, {
        element: scrollContainer,
        name: "scrollport",
      });
    };
    return scrollportConstraintFunction;
  }
  if (areaConstraint === "scroll") {
    const scrollAreaConstraintFunction = ({ scrollArea }) => {
      return createBoundConstraint(scrollArea, {
        element: scrollContainer,
        name: "scroll_area",
      });
    };
    return scrollAreaConstraintFunction;
  }
  if (typeof areaConstraint === "function") {
    const dynamicAreaConstraintFunction = (params) => {
      const bounds = areaConstraint(params);
      return createBoundConstraint(bounds, {
        name: "dynamic_area",
      });
    };
    return dynamicAreaConstraintFunction;
  }
  if (typeof areaConstraint === "object") {
    const { left, top, right, bottom } = areaConstraint;
    const turnSidePropertyInToGetter = (value, side) => {
      if (value === "scrollport") {
        return ({ scrollport }) => scrollport[side];
      }
      if (value === "scroll") {
        return ({ scrollArea }) => scrollArea[side];
      }
      if (typeof value === "function") {
        return value;
      }
      if (value === undefined) {
        // defaults to scrollport
        return ({ scrollport }) => scrollport[side];
      }
      return () => value;
    };
    const getLeft = turnSidePropertyInToGetter(left, "left");
    const getRight = turnSidePropertyInToGetter(right, "right");
    const getTop = turnSidePropertyInToGetter(top, "top");
    const getBottom = turnSidePropertyInToGetter(bottom, "bottom");

    const dynamicAreaConstraintFunction = (params) => {
      const bounds = {
        left: getLeft(params),
        right: getRight(params),
        top: getTop(params),
        bottom: getBottom(params),
      };
      return createBoundConstraint(bounds, {
        name: "dynamic_area",
      });
    };
    return dynamicAreaConstraintFunction;
  }
  console.warn(
    `Unknown areaConstraint value: ${areaConstraint}. Expected "scrollport", "scroll", "none", an object with boundary definitions, or a function returning boundary definitions.`,
  );
  return null;
};

const createObstacleConstraintsFromQuerySelector = (
  scrollableElement,
  { obstacleAttributeName, gestureInfo, isDraggedElementSticky = false },
) => {
  const dragGestureName = gestureInfo.name;
  const obstacles = scrollableElement.querySelectorAll(
    `[${obstacleAttributeName}]`,
  );
  const obstacleConstraintFunctions = [];
  for (const obstacle of obstacles) {
    if (obstacle.closest("[data-drag-ignore]")) {
      continue;
    }
    if (dragGestureName) {
      const obstacleAttributeValue = obstacle.getAttribute(
        obstacleAttributeName,
      );
      if (obstacleAttributeValue) {
        const obstacleNames = obstacleAttributeValue.split(",");
        const found = obstacleNames.some(
          (obstacleName) =>
            obstacleName.trim().toLowerCase() === dragGestureName.toLowerCase(),
        );
        if (!found) {
          continue;
        }
      }
    }

    obstacleConstraintFunctions.push(
      ({ hasCrossedVisibleAreaLeftOnce, hasCrossedVisibleAreaTopOnce }) => {
        // Only apply the "before crossing visible area" logic when dragging sticky elements
        // Non-sticky elements should be able to cross sticky obstacles while stuck regardless of visible area crossing
        const useOriginalPositionEvenIfSticky = isDraggedElementSticky
          ? !hasCrossedVisibleAreaLeftOnce && !hasCrossedVisibleAreaTopOnce
          : true;

        const obstacleScrollRelativeRect = getScrollRelativeRect(
          obstacle,
          scrollableElement,
          {
            useOriginalPositionEvenIfSticky,
          },
        );
        let obstacleBounds;
        if (
          useOriginalPositionEvenIfSticky &&
          obstacleScrollRelativeRect.isSticky
        ) {
          obstacleBounds = obstacleScrollRelativeRect;
        } else {
          obstacleBounds = addScrollToRect(obstacleScrollRelativeRect);
        }

        // obstacleBounds are already in scrollable-relative coordinates, no conversion needed
        const obstacleObject = createObstacleContraint(obstacleBounds, {
          name: `${obstacleBounds.isSticky ? "sticky " : ""}obstacle (${getElementSignature(obstacle)})`,
          element: obstacle,
        });
        return obstacleObject;
      },
    );
  }
  return obstacleConstraintFunctions;
};

const createBoundConstraint = (bounds, { name, element } = {}) => {
  const leftBound = bounds.left;
  const rightBound = bounds.right;
  const topBound = bounds.top;
  const bottomBound = bounds.bottom;

  const apply = ({ left, top, right, bottom, width, height }) => {
    let leftConstrained = left;
    let topConstrained = top;
    // Left boundary: element's left edge should not go before leftBound
    if (leftBound !== undefined && left < leftBound) {
      leftConstrained = leftBound;
    }
    // Right boundary: element's right edge should not go past rightBound
    if (rightBound !== undefined && right > rightBound) {
      leftConstrained = rightBound - width;
    }
    // Top boundary: element's top edge should not go before topBound
    if (topBound !== undefined && top < topBound) {
      topConstrained = topBound;
    }
    // Bottom boundary: element's bottom edge should not go past bottomBound
    if (bottomBound !== undefined && bottom > bottomBound) {
      topConstrained = bottomBound - height;
    }
    return [leftConstrained, topConstrained];
  };

  return {
    type: "bounds",
    name,
    apply,
    element,
    bounds,
  };
};
const createObstacleContraint = (bounds, { element, name }) => {
  const leftBound = bounds.left;
  const rightBound = bounds.right;
  const topBound = bounds.top;
  const bottomBound = bounds.bottom;
  const leftBoundRounded = roundForConstraints(leftBound);
  const rightBoundRounded = roundForConstraints(rightBound);
  const topBoundRounded = roundForConstraints(topBound);
  const bottomBoundRounded = roundForConstraints(bottomBound);

  const apply = ({
    left,
    top,
    right,
    bottom,
    width,
    height,
    currentLeft,
    currentTop,
  }) => {
    // Simple collision detection: check where element is and prevent movement into obstacle
    {
      // Determine current position relative to obstacle
      const currentLeftRounded = roundForConstraints(currentLeft);
      const currentRightRounded = roundForConstraints(currentLeft + width);
      const currentTopRounded = roundForConstraints(currentTop);
      const currentBottomRounded = roundForConstraints(currentTop + height);
      const isOnTheLeft = currentRightRounded <= leftBoundRounded;
      const isOnTheRight = currentLeftRounded >= rightBoundRounded;
      const isAbove = currentBottomRounded <= topBoundRounded;
      const isBelow = currentTopRounded >= bottomBoundRounded;

      // If element is on the left, apply X constraint to prevent moving right into obstacle
      if (isOnTheLeft) {
        const wouldHaveYOverlap = top < bottomBound && bottom > topBound;
        if (wouldHaveYOverlap) {
          const maxLeft = leftBound - width;
          if (left > maxLeft) {
            return [maxLeft, top];
          }
        }
      }
      // If element is on the right, apply X constraint to prevent moving left into obstacle
      else if (isOnTheRight) {
        const wouldHaveYOverlap = top < bottomBound && bottom > topBound;
        if (wouldHaveYOverlap) {
          const minLeft = rightBound;
          if (left < minLeft) {
            return [minLeft, top];
          }
        }
      }
      // If element is above, apply Y constraint to prevent moving down into obstacle
      else if (isAbove) {
        const wouldHaveXOverlap = left < rightBound && right > leftBound;
        if (wouldHaveXOverlap) {
          const maxTop = topBound - height;
          if (top > maxTop) {
            return [left, maxTop];
          }
        }
      }
      // If element is below, apply Y constraint to prevent moving up into obstacle
      else if (isBelow) {
        const wouldHaveXOverlap = left < rightBound && right > leftBound;
        if (wouldHaveXOverlap) {
          const minTop = bottomBound;
          if (top < minTop) {
            return [left, minTop];
          }
        }
      }
    }

    // Element is overlapping with obstacle - push it out in the direction of least resistance
    // Calculate distances to push element out in each direction
    const distanceToLeft = right - leftBound; // Distance to push left
    const distanceToRight = rightBound - left; // Distance to push right
    const distanceToTop = bottom - topBound; // Distance to push up
    const distanceToBottom = bottomBound - top; // Distance to push down
    // Find the minimum distance (direction of least resistance)
    const minDistance = Math.min(
      distanceToLeft,
      distanceToRight,
      distanceToTop,
      distanceToBottom,
    );
    if (minDistance === distanceToLeft) {
      // Push left: element should not go past leftBound - elementWidth
      const maxLeft = leftBound - width;
      if (left > maxLeft) {
        return [maxLeft, top];
      }
    } else if (minDistance === distanceToRight) {
      // Push right: element should not go before rightBound
      const minLeft = rightBound;
      if (left < minLeft) {
        return [minLeft, top];
      }
    } else if (minDistance === distanceToTop) {
      // Push up: element should not go past topBound - elementHeight
      const maxTop = topBound - height;
      if (top > maxTop) {
        return [left, maxTop];
      }
    } else if (minDistance === distanceToBottom) {
      // Push down: element should not go before bottomBound
      const minTop = bottomBound;
      if (top < minTop) {
        return [left, minTop];
      }
    }

    return null;
  };

  return {
    type: "obstacle",
    name,
    apply,
    element,
    bounds,
  };
};

/**
 * Rounds coordinates to prevent floating point precision issues in constraint calculations.
 *
 * This is critical for obstacle detection because:
 * 1. Boundary detection relies on precise comparisons (e.g., elementRight <= obstacleLeft)
 * 2. Floating point arithmetic can produce values like 149.99999999 instead of 150
 * 3. This causes incorrect boundary classifications (element appears "on left" when it should be "overlapping")
 *
 * Scroll events are more susceptible to this issue because:
 * - Mouse events use integer pixel coordinates from the DOM (e.g., clientX: 150)
 * - Scroll events use element.scrollLeft which can have sub-pixel values from CSS transforms, zoom, etc.
 * - Scroll compensation calculations (scrollDelta * ratios) amplify floating point errors
 * - Multiple scroll events accumulate these errors over time
 *
 * Using 2-decimal precision maintains smooth sub-pixel positioning while ensuring
 * reliable boundary detection for constraint systems.
 */
const roundForConstraints = (value) => {
  return Math.round(value * 100) / 100;
};

const applyStickyFrontiersToAutoScrollArea = (
  autoScrollArea,
  { direction, scrollContainer, dragName },
) => {
  let { left, right, top, bottom } = autoScrollArea;

  if (direction.x) {
    const horizontalStickyFrontiers = createStickyFrontierOnAxis(
      scrollContainer,
      {
        name: dragName,
        scrollContainer,
        primarySide: "left",
        oppositeSide: "right",
      },
    );
    for (const horizontalStickyFrontier of horizontalStickyFrontiers) {
      const { side, bounds, element } = horizontalStickyFrontier;
      if (side === "left") {
        if (bounds.right <= left) {
          continue;
        }
        left = bounds.right;
        continue;
      }
      // right
      if (bounds.left >= right) {
        continue;
      }
      right = bounds.left;
      continue;
    }
  }

  if (direction.y) {
    const verticalStickyFrontiers = createStickyFrontierOnAxis(
      scrollContainer,
      {
        name: dragName,
        scrollContainer,
        primarySide: "top",
        oppositeSide: "bottom",
      },
    );
    for (const verticalStickyFrontier of verticalStickyFrontiers) {
      const { side, bounds, element } = verticalStickyFrontier;

      // Frontier acts as a top barrier - constrains from the bottom edge of the frontier
      if (side === "top") {
        if (bounds.bottom <= top) {
          continue;
        }
        top = bounds.bottom;
        continue;
      }

      // Frontier acts as a bottom barrier - constrains from the top edge of the frontier
      if (bounds.top >= bottom) {
        continue;
      }
      bottom = bounds.top;
      continue;
    }
  }

  return { left, right, top, bottom };
};

const createStickyFrontierOnAxis = (
  element,
  { name, scrollContainer, primarySide, oppositeSide },
) => {
  const primaryAttrName = `data-drag-sticky-${primarySide}-frontier`;
  const oppositeAttrName = `data-drag-sticky-${oppositeSide}-frontier`;
  const frontiers = element.querySelectorAll(
    `[${primaryAttrName}], [${oppositeAttrName}]`,
  );
  const matchingStickyFrontiers = [];
  for (const frontier of frontiers) {
    if (frontier.closest("[data-drag-ignore]")) {
      continue;
    }
    const hasPrimary = frontier.hasAttribute(primaryAttrName);
    const hasOpposite = frontier.hasAttribute(oppositeAttrName);
    // Check if element has both sides (invalid)
    if (hasPrimary && hasOpposite) {
      const elementSignature = getElementSignature(frontier);
      console.warn(
        `Sticky frontier element (${elementSignature}) has both ${primarySide} and ${oppositeSide} attributes. 
  A sticky frontier should only have one side attribute.`,
      );
      continue;
    }
    const attrName = hasPrimary ? primaryAttrName : oppositeAttrName;
    const attributeValue = frontier.getAttribute(attrName);
    if (attributeValue && name) {
      const frontierNames = attributeValue.split(",");
      const isMatching = frontierNames.some(
        (frontierName) =>
          frontierName.trim().toLowerCase() === name.toLowerCase(),
      );
      if (!isMatching) {
        continue;
      }
    }
    const frontierBounds = getScrollRelativeRect(frontier, scrollContainer);
    const stickyFrontierObject = {
      type: "sticky-frontier",
      element: frontier,
      side: hasPrimary ? primarySide : oppositeSide,
      bounds: frontierBounds,
      name: `sticky_frontier_${hasPrimary ? primarySide : oppositeSide} (${getElementSignature(frontier)})`,
    };
    matchingStickyFrontiers.push(stickyFrontierObject);
  }
  return matchingStickyFrontiers;
};

const dragStyleController = createStyleController("drag_to_move");

const createDragToMoveGestureController = ({
  stickyFrontiers = true,
  // Padding to reduce the area used to autoscroll by this amount (applied after sticky frontiers)
  // This creates an invisible space around the area where elements cannot be dragged
  autoScrollAreaPadding = 0,
  // constraints,
  areaConstraint = "scroll", // "scroll" | "scrollport" | "none" | {left,top,right,bottom} | function
  obstaclesContainer,
  obstacleAttributeName = "data-drag-obstacle",
  // Visual feedback line connecting mouse cursor to the moving grab point when constraints prevent following
  // This provides intuitive feedback during drag operations when the element cannot reach the mouse
  // position due to obstacles, boundaries, or other constraints. The line originates from where the mouse
  // initially grabbed the element, but moves with the element to show the current anchor position.
  // It becomes visible when there's a significant distance between mouse and grab point.
  showConstraintFeedbackLine = true,
  showDebugMarkers = true,
  resetPositionAfterRelease = false,
  ...options
} = {}) => {
  const initGrabToMoveElement = (
    dragGesture,
    { element, referenceElement, elementToMove, convertScrollablePosition },
  ) => {
    const direction = dragGesture.gestureInfo.direction;
    dragGesture.gestureInfo.name;
    const scrollContainer = dragGesture.gestureInfo.scrollContainer;
    const elementImpacted = elementToMove || element;
    const translateXAtGrab = dragStyleController.getUnderlyingValue(
      elementImpacted,
      "transform.translateX",
    );
    const translateYAtGrab = dragStyleController.getUnderlyingValue(
      elementImpacted,
      "transform.translateY",
    );
    dragGesture.addReleaseCallback(() => {
      if (resetPositionAfterRelease) {
        dragStyleController.clear(elementImpacted);
      } else {
        dragStyleController.commit(elementImpacted);
      }
    });

    let elementWidth;
    let elementHeight;
    {
      const updateElementDimension = () => {
        const elementRect = element.getBoundingClientRect();
        elementWidth = elementRect.width;
        elementHeight = elementRect.height;
      };
      updateElementDimension();
      dragGesture.addBeforeDragCallback(updateElementDimension);
    }

    let scrollArea;
    {
      // computed at start so that scrollWidth/scrollHeight are fixed
      // even if the dragging side effects increases them afterwards
      scrollArea = {
        left: 0,
        top: 0,
        right: scrollContainer.scrollWidth,
        bottom: scrollContainer.scrollHeight,
      };
    }

    let scrollport;
    let autoScrollArea;
    {
      // for visible are we also want to snapshot the widht/height
      // and we'll add scrollContainer container scrolls during drag (getScrollport does that)
      const scrollBox = getScrollBox(scrollContainer);
      const updateScrollportAndAutoScrollArea = () => {
        scrollport = getScrollport(scrollBox, scrollContainer);
        autoScrollArea = scrollport;
        if (stickyFrontiers) {
          autoScrollArea = applyStickyFrontiersToAutoScrollArea(
            autoScrollArea,
            {
              scrollContainer,
              direction},
          );
        }
        if (autoScrollAreaPadding > 0) {
          autoScrollArea = {
            paddingLeft: autoScrollAreaPadding,
            paddingTop: autoScrollAreaPadding,
            paddingRight: autoScrollAreaPadding,
            paddingBottom: autoScrollAreaPadding,
            left: autoScrollArea.left + autoScrollAreaPadding,
            top: autoScrollArea.top + autoScrollAreaPadding,
            right: autoScrollArea.right - autoScrollAreaPadding,
            bottom: autoScrollArea.bottom - autoScrollAreaPadding,
          };
        }
      };
      updateScrollportAndAutoScrollArea();
      dragGesture.addBeforeDragCallback(updateScrollportAndAutoScrollArea);
    }

    // Set up dragging attribute
    element.setAttribute("data-grabbed", "");
    dragGesture.addReleaseCallback(() => {
      element.removeAttribute("data-grabbed");
    });

    // Will be used for dynamic constraints on sticky elements
    let hasCrossedScrollportLeftOnce = false;
    let hasCrossedScrollportTopOnce = false;
    const dragConstraints = initDragConstraints(dragGesture, {
      areaConstraint,
      obstaclesContainer: obstaclesContainer || scrollContainer,
      obstacleAttributeName,
      showConstraintFeedbackLine,
      showDebugMarkers,
      referenceElement,
    });
    dragGesture.addBeforeDragCallback(
      (layoutRequested, currentLayout, limitLayout, { dragEvent }) => {
        dragConstraints.applyConstraints(
          layoutRequested,
          currentLayout,
          limitLayout,
          {
            elementWidth,
            elementHeight,
            scrollArea,
            scrollport,
            hasCrossedScrollportLeftOnce,
            hasCrossedScrollportTopOnce,
            autoScrollArea,
            dragEvent,
          },
        );
      },
    );

    const dragToMove = (gestureInfo) => {
      const { isGoingDown, isGoingUp, isGoingLeft, isGoingRight, layout } =
        gestureInfo;
      const left = layout.left;
      const top = layout.top;
      const right = left + elementWidth;
      const bottom = top + elementHeight;

      {
        hasCrossedScrollportLeftOnce =
          hasCrossedScrollportLeftOnce || left < scrollport.left;
        hasCrossedScrollportTopOnce =
          hasCrossedScrollportTopOnce || top < scrollport.top;

        const getScrollMove = (axis) => {
          const isGoingPositive = axis === "x" ? isGoingRight : isGoingDown;
          if (isGoingPositive) {
            const elementEnd = axis === "x" ? right : bottom;
            const autoScrollAreaEnd =
              axis === "x" ? autoScrollArea.right : autoScrollArea.bottom;

            if (elementEnd <= autoScrollAreaEnd) {
              return 0;
            }
            const scrollAmountNeeded = elementEnd - autoScrollAreaEnd;
            return scrollAmountNeeded;
          }

          const isGoingNegative = axis === "x" ? isGoingLeft : isGoingUp;
          if (!isGoingNegative) {
            return 0;
          }

          const referenceOrEl = referenceElement || element;
          const canAutoScrollNegative =
            axis === "x"
              ? !referenceOrEl.hasAttribute("data-sticky-left") ||
                hasCrossedScrollportLeftOnce
              : !referenceOrEl.hasAttribute("data-sticky-top") ||
                hasCrossedScrollportTopOnce;
          if (!canAutoScrollNegative) {
            return 0;
          }

          const elementStart = axis === "x" ? left : top;
          const autoScrollAreaStart =
            axis === "x" ? autoScrollArea.left : autoScrollArea.top;
          if (elementStart >= autoScrollAreaStart) {
            return 0;
          }

          const scrollAmountNeeded = autoScrollAreaStart - elementStart;
          return -scrollAmountNeeded;
        };

        let scrollLeftTarget;
        let scrollTopTarget;
        if (direction.x) {
          const containerScrollLeftMove = getScrollMove("x");
          if (containerScrollLeftMove) {
            scrollLeftTarget =
              scrollContainer.scrollLeft + containerScrollLeftMove;
          }
        }
        if (direction.y) {
          const containerScrollTopMove = getScrollMove("y");
          if (containerScrollTopMove) {
            scrollTopTarget =
              scrollContainer.scrollTop + containerScrollTopMove;
          }
        }
        // now we know what to do, do it
        if (scrollLeftTarget !== undefined) {
          scrollContainer.scrollLeft = scrollLeftTarget;
        }
        if (scrollTopTarget !== undefined) {
          scrollContainer.scrollTop = scrollTopTarget;
        }
      }

      {
        const { scrollableLeft, scrollableTop } = layout;
        const [positionedLeft, positionedTop] = convertScrollablePosition(
          scrollableLeft,
          scrollableTop,
        );
        const transform = {};
        if (direction.x) {
          const leftTarget = positionedLeft;
          const leftAtGrab = dragGesture.gestureInfo.leftAtGrab;
          const leftDelta = leftTarget - leftAtGrab;
          const translateX = translateXAtGrab
            ? translateXAtGrab + leftDelta
            : leftDelta;
          transform.translateX = translateX;
          // console.log({
          //   leftAtGrab,
          //   scrollableLeft,
          //   left,
          //   leftTarget,
          // });
        }
        if (direction.y) {
          const topTarget = positionedTop;
          const topAtGrab = dragGesture.gestureInfo.topAtGrab;
          const topDelta = topTarget - topAtGrab;
          const translateY = translateYAtGrab
            ? translateYAtGrab + topDelta
            : topDelta;
          transform.translateY = translateY;
        }
        dragStyleController.set(elementImpacted, {
          transform,
        });
      }
    };
    dragGesture.addDragCallback(dragToMove);
  };

  const dragGestureController = createDragGestureController(options);
  const grab = dragGestureController.grab;
  dragGestureController.grab = ({
    element,
    referenceElement,
    elementToMove,
    ...rest
  } = {}) => {
    const scrollContainer = getScrollContainer(referenceElement || element);
    const [
      elementScrollableLeft,
      elementScrollableTop,
      convertScrollablePosition,
    ] = createDragElementPositioner(element, referenceElement, elementToMove);
    const dragGesture = grab({
      element,
      scrollContainer,
      layoutScrollableLeft: elementScrollableLeft,
      layoutScrollableTop: elementScrollableTop,
      ...rest,
    });
    initGrabToMoveElement(dragGesture, {
      element,
      referenceElement,
      elementToMove,
      convertScrollablePosition,
    });
    return dragGesture;
  };

  return dragGestureController;
};

const startDragToResizeGesture = (
  pointerdownEvent,
  { onDragStart, onDrag, onRelease, ...options },
) => {
  const target = pointerdownEvent.target;
  if (!target.closest) {
    return null;
  }
  const elementWithDataResizeHandle = target.closest("[data-resize-handle]");
  if (!elementWithDataResizeHandle) {
    return null;
  }
  let elementToResize;
  const dataResizeHandle =
    elementWithDataResizeHandle.getAttribute("data-resize-handle");
  if (!dataResizeHandle || dataResizeHandle === "true") {
    elementToResize = elementWithDataResizeHandle.closest("[data-resize]");
  } else {
    elementToResize = document.querySelector(`#${dataResizeHandle}`);
  }
  if (!elementToResize) {
    console.warn("No element to resize found");
    return null;
  }
  // inspired by https://developer.mozilla.org/en-US/docs/Web/CSS/resize
  // "horizontal", "vertical", "both"
  const resizeDirection = getResizeDirection(elementToResize);
  if (!resizeDirection.x && !resizeDirection.y) {
    return null;
  }

  const dragToResizeGestureController = createDragGestureController({
    onDragStart: (...args) => {
      onDragStart?.(...args);
    },
    onDrag,
    onRelease: (...args) => {
      elementWithDataResizeHandle.removeAttribute("data-active");
      onRelease?.(...args);
    },
  });
  elementWithDataResizeHandle.setAttribute("data-active", "");
  const dragToResizeGesture = dragToResizeGestureController.grabViaPointer(
    pointerdownEvent,
    {
      element: elementToResize,
      direction: resizeDirection,
      cursor:
        resizeDirection.x && resizeDirection.y
          ? "nwse-resize"
          : resizeDirection.x
            ? "ew-resize"
            : "ns-resize",
      ...options,
    },
  );
  return dragToResizeGesture;
};

const getResizeDirection = (element) => {
  const direction = element.getAttribute("data-resize");
  const x = direction === "horizontal" || direction === "both";
  const y = direction === "vertical" || direction === "both";
  return { x, y };
};

/**
 * Detects the drop target based on what element is actually under the mouse cursor.
 * Uses document.elementsFromPoint() to respect visual stacking order naturally.
 *
 * @param {Object} gestureInfo - Gesture information
 * @param {Element[]} targetElements - Array of potential drop target elements
 * @returns {Object|null} Drop target info with elementSide or null if no valid target found
 */
const getDropTargetInfo = (gestureInfo, targetElements) => {
  const dragElement = gestureInfo.element;
  const dragElementRect = dragElement.getBoundingClientRect();
  const intersectingTargets = [];
  let someTargetIsCol;
  let someTargetIsTr;
  for (const targetElement of targetElements) {
    const targetRect = targetElement.getBoundingClientRect();
    if (!rectangleAreIntersecting(dragElementRect, targetRect)) {
      continue;
    }
    if (!someTargetIsCol && targetElement.tagName === "COL") {
      someTargetIsCol = true;
    }
    if (!someTargetIsTr && targetElement.tagName === "TR") {
      someTargetIsTr = true;
    }
    intersectingTargets.push(targetElement);
  }

  if (intersectingTargets.length === 0) {
    return null;
  }

  const dragElementCenterX = dragElementRect.left + dragElementRect.width / 2;
  const dragElementCenterY = dragElementRect.top + dragElementRect.height / 2;
  // Clamp coordinates to viewport to avoid issues with elementsFromPoint
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  const clientX =
    dragElementCenterX < 0
      ? 0
      : dragElementCenterX > viewportWidth
        ? viewportWidth - 1
        : dragElementCenterX;
  const clientY =
    dragElementCenterY < 0
      ? 0
      : dragElementCenterY > viewportHeight
        ? viewportHeight - 1
        : dragElementCenterY;

  // Find the first target element in the stack (topmost visible target)
  const elementsUnderDragElement = document.elementsFromPoint(clientX, clientY);
  let targetElement = null;
  let targetIndex = -1;
  for (const element of elementsUnderDragElement) {
    // First, check if the element itself is a target
    const directIndex = intersectingTargets.indexOf(element);
    if (directIndex !== -1) {
      targetElement = element;
      targetIndex = directIndex;
      break;
    }
    // Special case: if element is <td> or <th> and not in targets,
    // try to find its corresponding <col> element
    if (!isTableCell(element)) {
      continue;
    }
    try_col: {
      if (!someTargetIsCol) {
        break try_col;
      }
      const tableCellCol = findTableCellCol(element);
      if (!tableCellCol) {
        break try_col;
      }
      const colIndex = intersectingTargets.indexOf(tableCellCol);
      if (colIndex === -1) {
        break try_col;
      }
      targetElement = tableCellCol;
      targetIndex = colIndex;
      break;
    }
    try_tr: {
      if (!someTargetIsTr) {
        break try_tr;
      }
      const tableRow = element.closest("tr");
      const rowIndex = targetElements.indexOf(tableRow);
      if (rowIndex === -1) {
        break try_tr;
      }
      targetElement = tableRow;
      targetIndex = rowIndex;
      break;
    }
  }
  if (!targetElement) {
    targetElement = intersectingTargets[0];
    targetIndex = 0;
  }

  // Determine position within the target for both axes
  const targetRect = targetElement.getBoundingClientRect();
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;
  const result = {
    index: targetIndex,
    element: targetElement,
    elementSide: {
      x: dragElementRect.left < targetCenterX ? "start" : "end",
      y: dragElementRect.top < targetCenterY ? "start" : "end",
    },
    intersecting: intersectingTargets,
  };
  return result;
};

const rectangleAreIntersecting = (r1, r2) => {
  return !(
    r2.left > r1.right ||
    r2.right < r1.left ||
    r2.top > r1.bottom ||
    r2.bottom < r1.top
  );
};

const isTableCell = (el) => {
  return el.tagName === "TD" || el.tagName === "TH";
};

/**
 * Find the corresponding <col> element for a given <td> or <th> cell
 * @param {Element} cellElement - The <td> or <th> element
 * @param {Element[]} targetColElements - Array of <col> elements to search in
 * @returns {Element|null} The corresponding <col> element or null if not found
 */
const findTableCellCol = (cellElement) => {
  const table = cellElement.closest("table");
  const colgroup = table.querySelector("colgroup");
  if (!colgroup) {
    return null;
  }
  const cols = colgroup.querySelectorAll("col");
  const columnIndex = cellElement.cellIndex;
  const correspondingCol = cols[columnIndex];
  return correspondingCol;
};

const getPositionedParent = (element) => {
  let parent = element.parentElement;
  while (parent && parent !== document.body) {
    const position = window.getComputedStyle(parent).position;
    if (
      position === "relative" ||
      position === "absolute" ||
      position === "fixed"
    ) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return document.body;
};

const getHeight = (element) => {
  const { height } = element.getBoundingClientRect();
  return height;
};

const getWidth = (element) => {
  const { width } = element.getBoundingClientRect();
  return width;
};

installImportMetaCss(import.meta);
import.meta.css = /* css */ `
  [data-position-sticky-placeholder] {
    opacity: 0 !important;
    position: static !important;
    width: auto !important;
    height: auto !important;
  }
`;

const initPositionSticky = (element) => {
  const computedStyle = getComputedStyle(element);
  const topCssValue = computedStyle.top;
  const top = parseFloat(topCssValue);
  if (isNaN(top)) {
    return () => {}; // Early return if no valid top value
  }

  // Skip polyfill if native position:sticky would work (no overflow:auto/hidden parents)
  const scrollContainerSet = getScrollContainerSet(element);
  {
    let hasOverflowHiddenOrAuto = false;
    for (const scrollContainer of scrollContainerSet) {
      const scrollContainerComputedStyle = getComputedStyle(scrollContainer);
      const overflowX = scrollContainerComputedStyle.overflowX;
      if (overflowX === "auto" || overflowX === "hidden") {
        hasOverflowHiddenOrAuto = true;
        break;
      }
      const overflowY = scrollContainerComputedStyle.overflowY;
      if (overflowY === "auto" || overflowY === "hidden") {
        hasOverflowHiddenOrAuto = true;
        break;
      }
    }
    if (!hasOverflowHiddenOrAuto) {
      return () => {}; // Native sticky will work fine
    }
  }

  const cleanupCallbackSet = new Set();
  const cleanup = () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };

  const parentElement = element.parentElement;
  const createPlaceholderClone = () => {
    const clone = element.cloneNode(true);
    clone.setAttribute("data-position-sticky-placeholder", "");
    clone.removeAttribute("data-sticky");
    return clone;
  };

  let placeholder = createPlaceholderClone();
  parentElement.insertBefore(placeholder, element);
  cleanupCallbackSet.add(() => {
    placeholder.remove();
  });

  let width = getWidth(element);
  let height = getHeight(element);

  const updateSize = () => {
    const newPlaceholder = createPlaceholderClone();
    parentElement.replaceChild(newPlaceholder, placeholder);
    placeholder = newPlaceholder;
    width = getWidth(placeholder);
    height = getHeight(placeholder);
    updatePosition();
  };

  const updatePosition = () => {
    // Ensure placeholder dimensions match element
    setStyles(placeholder, {
      width: `${width}px`,
      height: `${height}px`,
    });

    const placeholderRect = placeholder.getBoundingClientRect();
    const parentRect = parentElement.getBoundingClientRect();

    // Calculate left position in viewport coordinates (fixed positioning)
    const leftPosition = placeholderRect.left;
    element.style.left = `${Math.round(leftPosition)}px`;

    // Determine if element should be sticky or at its natural position
    let topPosition;
    let isStuck = false;

    // Check if we need to stick the element
    if (placeholderRect.top <= top) {
      // Element should be stuck at "top" position in the viewport
      topPosition = top;
      isStuck = true;

      // But make sure it doesn't go beyond parent's bottom boundary
      const parentBottom = parentRect.bottom;
      const elementBottom = top + height;

      if (elementBottom > parentBottom) {
        // Adjust to stay within parent
        topPosition = parentBottom - height;
      }
    } else {
      // Element should be at its natural position in the flow
      topPosition = placeholderRect.top;
    }

    element.style.top = `${topPosition}px`;
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;

    // Set attribute for potential styling
    if (isStuck) {
      element.setAttribute("data-sticky", "");
    } else {
      element.removeAttribute("data-sticky");
    }
  };

  {
    const restorePositionStyle = forceStyles(element, {
      "position": "fixed",
      "z-index": 1,
      "will-change": "transform", // Hint for hardware acceleration
    });
    cleanupCallbackSet.add(restorePositionStyle);
  }

  updatePosition();

  {
    const handleScroll = () => {
      updatePosition();
    };

    for (const scrollContainer of scrollContainerSet) {
      scrollContainer.addEventListener("scroll", handleScroll, {
        passive: true,
      });
      cleanupCallbackSet.add(() => {
        scrollContainer.removeEventListener("scroll", handleScroll, {
          passive: true,
        });
      });
    }
  }

  {
    let animationFrame = null;
    const resizeObserver = new ResizeObserver(() => {
      if (animationFrame !== null) {
        return;
      }
      animationFrame = requestAnimationFrame(() => {
        animationFrame = null;
        updateSize();
      });
    });
    resizeObserver.observe(parentElement);
    cleanupCallbackSet.add(() => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    });
  }

  {
    const mutationObserver = new MutationObserver(() => {
      updateSize();
    });
    mutationObserver.observe(element, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    cleanupCallbackSet.add(() => {
      mutationObserver.disconnect();
    });
  }

  return cleanup;
};

const stickyAsRelativeCoords = (
  element,
  referenceElement,
  { scrollContainer = getScrollContainer(element) } = {},
) => {
  const hasStickyLeftAttribute = element.hasAttribute("data-sticky-left");
  const hasTopStickyAttribute = element.hasAttribute("data-sticky-top");
  if (!hasStickyLeftAttribute && !hasTopStickyAttribute) {
    return null;
  }
  const elementRect = element.getBoundingClientRect();
  const referenceElementRect = referenceElement.getBoundingClientRect();
  const computedStyle = getComputedStyle(element);
  const isDocumentScrolling = scrollContainer === document.documentElement;

  let leftPosition;
  let topPosition;
  if (isDocumentScrolling) {
    // For document scrolling: check if element is currently stuck and calculate offset

    if (hasStickyLeftAttribute) {
      const cssLeftValue = parseFloat(computedStyle.left) || 0;
      const isStuckLeft = elementRect.left <= cssLeftValue;
      if (isStuckLeft) {
        const elementOffsetRelative =
          elementRect.left - referenceElementRect.left;
        leftPosition = elementOffsetRelative - cssLeftValue;
      } else {
        leftPosition = 0;
      }
    }
    if (hasTopStickyAttribute) {
      const cssTopValue = parseFloat(computedStyle.top) || 0;
      const isStuckTop = elementRect.top <= cssTopValue;
      if (isStuckTop) {
        const elementOffsetRelative =
          elementRect.top - referenceElementRect.top;
        topPosition = elementOffsetRelative - cssTopValue;
      } else {
        topPosition = 0;
      }
    }
    return [leftPosition, topPosition];
  }

  // For container scrolling: check if element is currently stuck and calculate offset
  const scrollContainerRect = scrollContainer.getBoundingClientRect();
  if (hasStickyLeftAttribute) {
    const cssLeftValue = parseFloat(computedStyle.left) || 0;
    // Check if element is stuck to the left edge of the scrollable container
    const isStuckLeft =
      elementRect.left <= scrollContainerRect.left + cssLeftValue;
    if (isStuckLeft) {
      // Element is stuck - calculate its offset relative to reference element
      const elementOffsetRelative =
        elementRect.left - referenceElementRect.left;
      leftPosition = elementOffsetRelative - cssLeftValue;
    } else {
      // Element is not stuck - behaves like position: relative with no offset
      leftPosition = 0;
    }
  }
  if (hasTopStickyAttribute) {
    const cssTopValue = parseFloat(computedStyle.top) || 0;
    // Check if element is stuck to the top edge of the scrollable container
    const isStuckTop = elementRect.top <= scrollContainerRect.top + cssTopValue;
    if (isStuckTop) {
      // Element is stuck - calculate its offset relative to reference element
      const elementOffsetRelative = elementRect.top - referenceElementRect.top;
      topPosition = elementOffsetRelative - cssTopValue;
    } else {
      // Element is not stuck - behaves like position: relative with no offset
      topPosition = 0;
    }
  }
  return [leftPosition, topPosition];
};

// Creates a visible rect effect that tracks how much of an element is visible within its scrollable parent
// and within the document viewport. This is useful for implementing overlays, lazy loading, or any UI
// that needs to react to element visibility changes.
//
// The function returns two visibility ratios:
// - scrollVisibilityRatio: Visibility ratio relative to the scrollable parent (0-1)
// - visibilityRatio: Visibility ratio relative to the document viewport (0-1)
//
// When scrollable parent is the document, both ratios will be the same.
// When scrollable parent is a custom container, scrollVisibilityRatio might be 1.0 (fully visible
// within the container) while visibilityRatio could be 0.0 (container is scrolled out of viewport).
// A bit like https://tetherjs.dev/ but different
const visibleRectEffect = (element, update) => {
  const [teardown, addTeardown] = createPubSub();
  const scrollContainer = getScrollContainer(element);
  const scrollContainerIsDocument =
    scrollContainer === document.documentElement;
  const check = (reason) => {

    // 1. Calculate element position relative to scrollable parent
    const { scrollLeft, scrollTop } = scrollContainer;
    const visibleAreaLeft = scrollLeft;
    const visibleAreaTop = scrollTop;

    // Get element position relative to its scrollable parent
    let elementAbsoluteLeft;
    let elementAbsoluteTop;
    if (scrollContainerIsDocument) {
      // For document scrolling, use offsetLeft/offsetTop relative to document
      const rect = element.getBoundingClientRect();
      elementAbsoluteLeft = rect.left + scrollLeft;
      elementAbsoluteTop = rect.top + scrollTop;
    } else {
      // For custom container, get position relative to the container
      const elementRect = element.getBoundingClientRect();
      const scrollContainerRect = scrollContainer.getBoundingClientRect();
      elementAbsoluteLeft =
        elementRect.left - scrollContainerRect.left + scrollLeft;
      elementAbsoluteTop =
        elementRect.top - scrollContainerRect.top + scrollTop;
    }

    const leftVisible =
      visibleAreaLeft < elementAbsoluteLeft
        ? elementAbsoluteLeft - visibleAreaLeft
        : 0;
    const topVisible =
      visibleAreaTop < elementAbsoluteTop
        ? elementAbsoluteTop - visibleAreaTop
        : 0;
    // Convert to overlay coordinates (adjust for custom scrollable container)
    let overlayLeft = leftVisible;
    let overlayTop = topVisible;
    if (!scrollContainerIsDocument) {
      const { left: scrollableLeft, top: scrollableTop } =
        scrollContainer.getBoundingClientRect();
      overlayLeft += scrollableLeft;
      overlayTop += scrollableTop;
    }

    // 2. Calculate element visible width/height
    const { width, height } = element.getBoundingClientRect();
    const visibleAreaWidth = scrollContainer.clientWidth;
    const visibleAreaHeight = scrollContainer.clientHeight;
    const visibleAreaRight = visibleAreaLeft + visibleAreaWidth;
    const visibleAreaBottom = visibleAreaTop + visibleAreaHeight;
    // 2.1 Calculate visible width
    let widthVisible;
    {
      const maxVisibleWidth = visibleAreaWidth - leftVisible;
      const elementAbsoluteRight = elementAbsoluteLeft + width;
      const elementLeftIsVisible = elementAbsoluteLeft >= visibleAreaLeft;
      const elementRightIsVisible = elementAbsoluteRight <= visibleAreaRight;
      if (elementLeftIsVisible && elementRightIsVisible) {
        // Element fully visible horizontally
        widthVisible = width;
      } else if (elementLeftIsVisible && !elementRightIsVisible) {
        // Element left is visible, right is cut off
        widthVisible = visibleAreaRight - elementAbsoluteLeft;
      } else if (!elementLeftIsVisible && elementRightIsVisible) {
        // Element left is cut off, right is visible
        widthVisible = elementAbsoluteRight - visibleAreaLeft;
      } else {
        // Element spans beyond both sides, show only visible area portion
        widthVisible = maxVisibleWidth;
      }
    }
    // 2.2 Calculate visible height
    let heightVisible;
    {
      const maxVisibleHeight = visibleAreaHeight - topVisible;
      const elementAbsoluteBottom = elementAbsoluteTop + height;
      const elementTopIsVisible = elementAbsoluteTop >= visibleAreaTop;
      const elementBottomIsVisible = elementAbsoluteBottom <= visibleAreaBottom;
      if (elementTopIsVisible && elementBottomIsVisible) {
        // Element fully visible vertically
        heightVisible = height;
      } else if (elementTopIsVisible && !elementBottomIsVisible) {
        // Element top is visible, bottom is cut off
        heightVisible = visibleAreaBottom - elementAbsoluteTop;
      } else if (!elementTopIsVisible && elementBottomIsVisible) {
        // Element top is cut off, bottom is visible
        heightVisible = elementAbsoluteBottom - visibleAreaTop;
      } else {
        // Element spans beyond both sides, show only visible area portion
        heightVisible = maxVisibleHeight;
      }
    }

    // Calculate visibility ratios
    const scrollVisibilityRatio =
      (widthVisible * heightVisible) / (width * height);
    // Calculate visibility ratio relative to document viewport
    let documentVisibilityRatio;
    if (scrollContainerIsDocument) {
      documentVisibilityRatio = scrollVisibilityRatio;
    } else {
      // For custom containers, calculate visibility relative to document viewport
      const elementRect = element.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      // Calculate how much of the element is visible in the document viewport
      const elementLeft = Math.max(0, elementRect.left);
      const elementTop = Math.max(0, elementRect.top);
      const elementRight = Math.min(viewportWidth, elementRect.right);
      const elementBottom = Math.min(viewportHeight, elementRect.bottom);
      const documentVisibleWidth = Math.max(0, elementRight - elementLeft);
      const documentVisibleHeight = Math.max(0, elementBottom - elementTop);
      documentVisibilityRatio =
        (documentVisibleWidth * documentVisibleHeight) / (width * height);
    }

    const visibleRect = {
      left: overlayLeft,
      top: overlayTop,
      right: overlayLeft + widthVisible,
      bottom: overlayTop + heightVisible,
      width: widthVisible,
      height: heightVisible,
      visibilityRatio: documentVisibilityRatio,
      scrollVisibilityRatio,
    };
    update(visibleRect, {
      width,
      height,
    });
  };

  check();

  const [publishBeforeAutoCheck, onBeforeAutoCheck] = createPubSub();
  {
    const autoCheck = (reason) => {
      const beforeCheckResults = publishBeforeAutoCheck(reason);
      check();
      for (const beforeCheckResult of beforeCheckResults) {
        if (typeof beforeCheckResult === "function") {
          beforeCheckResult();
        }
      }
    };
    // let rafId = null;
    // const scheduleCheck = (reason) => {
    //   cancelAnimationFrame(rafId);
    //   rafId = requestAnimationFrame(() => {
    //     autoCheck(reason);
    //   });
    // };
    // addTeardown(() => {
    //   cancelAnimationFrame(rafId);
    // });

    {
      // If scrollable parent is not document, also listen to document scroll
      // to update UI position when the scrollable parent moves in viewport
      const onDocumentScroll = () => {
        autoCheck("document_scroll");
      };
      document.addEventListener("scroll", onDocumentScroll, {
        passive: true,
      });
      addTeardown(() => {
        document.removeEventListener("scroll", onDocumentScroll, {
          passive: true,
        });
      });
      if (!scrollContainerIsDocument) {
        const onScroll = () => {
          autoCheck("scrollable_parent_scroll");
        };
        scrollContainer.addEventListener("scroll", onScroll, {
          passive: true,
        });
        addTeardown(() => {
          scrollContainer.removeEventListener("scroll", onScroll, {
            passive: true,
          });
        });
      }
    }
    {
      const onWindowResize = () => {
        autoCheck("window_size_change");
      };
      window.addEventListener("resize", onWindowResize);
      addTeardown(() => {
        window.removeEventListener("resize", onWindowResize);
      });
    }
    {
      const resizeObserver = new ResizeObserver(() => {
        {
          return;
        }
      });
      resizeObserver.observe(element);
      // Temporarily disconnect ResizeObserver to prevent feedback loops eventually caused by update function
      onBeforeAutoCheck(() => {
        resizeObserver.unobserve(element);
        return () => {
          // This triggers a new call to the resive observer that will be ignored thanks to
          // the widthDiff/heightDiff early return
          resizeObserver.observe(element);
        };
      });
      addTeardown(() => {
        resizeObserver.disconnect();
      });
    }
    {
      const documentIntersectionObserver = new IntersectionObserver(
        () => {
          autoCheck("element_intersection_with_document_change");
        },
        {
          root: null,
          rootMargin: "0px",
          threshold: [0, 0.1, 0.9, 1],
        },
      );
      documentIntersectionObserver.observe(element);
      addTeardown(() => {
        documentIntersectionObserver.disconnect();
      });
      if (!scrollContainerIsDocument) {
        const scrollIntersectionObserver = new IntersectionObserver(
          () => {
            autoCheck("element_intersection_with_scroll_change");
          },
          {
            root: scrollContainer,
            rootMargin: "0px",
            threshold: [0, 0, 1, 0.9, 1],
          },
        );
        scrollIntersectionObserver.observe(element);
        addTeardown(() => {
          scrollIntersectionObserver.disconnect();
        });
      }
    }
    {
      const onWindowTouchMove = () => {
        autoCheck("window_touchmove");
      };
      window.addEventListener("touchmove", onWindowTouchMove, {
        passive: true,
      });
      addTeardown(() => {
        window.removeEventListener("touchmove", onWindowTouchMove, {
          passive: true,
        });
      });
    }
  }

  return {
    check,
    onBeforeAutoCheck,
    disconnect: () => {
      teardown();
    },
  };
};

const pickPositionRelativeTo = (
  element,
  target,
  {
    alignToViewportEdgeWhenTargetNearEdge = 0,
    minLeft = 0,
    positionPreference,
    forcePosition,
  } = {},
) => {

  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  // Get viewport-relative positions
  const elementRect = element.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const {
    left: elementLeft,
    right: elementRight,
    top: elementTop,
    bottom: elementBottom,
  } = elementRect;
  const {
    left: targetLeft,
    right: targetRight,
    top: targetTop,
    bottom: targetBottom,
  } = targetRect;
  const elementWidth = elementRight - elementLeft;
  const elementHeight = elementBottom - elementTop;
  const targetWidth = targetRight - targetLeft;

  // Calculate horizontal position (viewport-relative)
  let elementPositionLeft;
  {
    // Check if target element is wider than viewport
    const targetIsWiderThanViewport = targetWidth > viewportWidth;
    if (targetIsWiderThanViewport) {
      const targetLeftIsVisible = targetLeft >= 0;
      const targetRightIsVisible = targetRight <= viewportWidth;

      if (!targetLeftIsVisible && targetRightIsVisible) {
        // Target extends beyond left edge but right side is visible
        const viewportCenter = viewportWidth / 2;
        const distanceFromRightEdge = viewportWidth - targetRight;
        elementPositionLeft =
          viewportCenter - distanceFromRightEdge / 2 - elementWidth / 2;
      } else if (targetLeftIsVisible && !targetRightIsVisible) {
        // Target extends beyond right edge but left side is visible
        const viewportCenter = viewportWidth / 2;
        const distanceFromLeftEdge = -targetLeft;
        elementPositionLeft =
          viewportCenter - distanceFromLeftEdge / 2 - elementWidth / 2;
      } else {
        // Target extends beyond both edges or is fully visible (center in viewport)
        elementPositionLeft = viewportWidth / 2 - elementWidth / 2;
      }
    } else {
      // Target fits within viewport width - center element relative to target
      elementPositionLeft = targetLeft + targetWidth / 2 - elementWidth / 2;
      // Special handling when element is wider than target
      if (alignToViewportEdgeWhenTargetNearEdge) {
        const elementIsWiderThanTarget = elementWidth > targetWidth;
        const targetIsNearLeftEdge =
          targetLeft < alignToViewportEdgeWhenTargetNearEdge;
        if (elementIsWiderThanTarget && targetIsNearLeftEdge) {
          elementPositionLeft = minLeft; // Left edge of viewport
        }
      }
    }
    // Constrain horizontal position to viewport boundaries
    if (elementPositionLeft < 0) {
      elementPositionLeft = 0;
    } else if (elementPositionLeft + elementWidth > viewportWidth) {
      elementPositionLeft = viewportWidth - elementWidth;
    }
  }

  // Calculate vertical position (viewport-relative)
  let position;
  const spaceAboveTarget = targetTop;
  const spaceBelowTarget = viewportHeight - targetBottom;
  determine_position: {
    if (forcePosition) {
      position = forcePosition;
      break determine_position;
    }
    const elementPreferredPosition = element.getAttribute("data-position");
    const minContentVisibilityRatio = 0.6; // 60% minimum visibility to keep position

    // Check positionPreference parameter first, then element attribute
    const preferredPosition = positionPreference || elementPreferredPosition;

    if (preferredPosition) {
      // Element has a preferred position - try to keep it unless we really struggle
      const visibleRatio =
        preferredPosition === "above"
          ? spaceAboveTarget / elementHeight
          : spaceBelowTarget / elementHeight;
      const canShowMinimumContent = visibleRatio >= minContentVisibilityRatio;
      if (canShowMinimumContent) {
        position = preferredPosition;
        break determine_position;
      }
    }
    // No preferred position - use original logic (prefer below, fallback to above if more space)
    const elementFitsBelow = spaceBelowTarget >= elementHeight;
    if (elementFitsBelow) {
      position = "below";
      break determine_position;
    }
    const hasMoreSpaceBelow = spaceBelowTarget >= spaceAboveTarget;
    position = hasMoreSpaceBelow ? "below" : "above";
  }

  let elementPositionTop;
  {
    if (position === "below") {
      // Calculate top position when placing below target (ensure whole pixels)
      const idealTopWhenBelow = targetBottom;
      elementPositionTop =
        idealTopWhenBelow % 1 === 0
          ? idealTopWhenBelow
          : Math.floor(idealTopWhenBelow) + 1;
    } else {
      // Calculate top position when placing above target
      const idealTopWhenAbove = targetTop - elementHeight;
      const minimumTopInViewport = 0;
      elementPositionTop =
        idealTopWhenAbove < minimumTopInViewport
          ? minimumTopInViewport
          : idealTopWhenAbove;
    }
  }

  // Get document scroll for final coordinate conversion
  const { scrollLeft, scrollTop } = document.documentElement;
  const elementDocumentLeft = elementPositionLeft + scrollLeft;
  const elementDocumentTop = elementPositionTop + scrollTop;
  const targetDocumentLeft = targetLeft + scrollLeft;
  const targetDocumentTop = targetTop + scrollTop;
  const targetDocumentRight = targetRight + scrollLeft;
  const targetDocumentBottom = targetBottom + scrollTop;

  return {
    position,
    left: elementDocumentLeft,
    top: elementDocumentTop,
    width: elementWidth,
    height: elementHeight,
    targetLeft: targetDocumentLeft,
    targetTop: targetDocumentTop,
    targetRight: targetDocumentRight,
    targetBottom: targetDocumentBottom,
    spaceAboveTarget,
    spaceBelowTarget,
  };
};

const [publishDebugger, subscribeDebugger] = createPubSub();

const notifyDebuggerStart = () => {
  const results = publishDebugger();
  const notifyDebuggerEnd = () => {
    for (const result of results) {
      if (typeof result === "function") {
        result();
      }
    }
  };
  return notifyDebuggerEnd;
};

const EASING = {
  LINEAR: (x) => x,
  EASE: (x) => {
    return cubicBezier(x, 0.25, 0.1, 0.25, 1.0);
  },
  EASE_IN: (x) => {
    return cubicBezier(x, 0.42, 0, 1.0, 1.0);
  },
  EASE_OUT: (x) => {
    return cubicBezier(x, 0, 0, 0.58, 1.0);
  },
  EASE_IN_OUT: (x) => {
    return cubicBezier(x, 0.42, 0, 0.58, 1.0);
  },
  EASE_IN_OUT_CUBIC: (x) => {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  },
  EASE_IN_EXPO: (x) => {
    return x === 0 ? 0 : Math.pow(2, 10 * x - 10);
  },
  EASE_OUT_EXPO: (x) => {
    return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
  },
  EASE_OUT_ELASTIC: (x) => {
    const c4 = (2 * Math.PI) / 3;
    if (x === 0) {
      return 0;
    }
    if (x === 1) {
      return 1;
    }
    return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
  },
  EASE_OUT_CUBIC: (x) => {
    return 1 - Math.pow(1 - x, 3);
  },
};

const cubicBezier = (t, initial, p1, p2, final) => {
  return (
    (1 - t) * (1 - t) * (1 - t) * initial +
    3 * (1 - t) * (1 - t) * t * p1 +
    3 * (1 - t) * t * t * p2 +
    t * t * t * final
  );
};

const getTimelineCurrentTime = () => {
  return document.timeline.currentTime;
};

const visualCallbackSet = new Set();
const backgroundCallbackSet = new Set();
const addOnTimeline = (callback, isVisual) => {
  if (isVisual) {
    visualCallbackSet.add(callback);
  } else {
    backgroundCallbackSet.add(callback);
  }
};
const removeFromTimeline = (callback, isVisual) => {
  if (isVisual) {
    visualCallbackSet.delete(callback);
  } else {
    backgroundCallbackSet.delete(callback);
  }
};

// We need setTimeout to animate things like volume because requestAnimationFrame would be killed when tab is not visible
// while we might want to fadeout volumn when leaving the page for instance
const createBackgroundUpdateLoop = () => {
  let timeout;
  const update = () => {
    for (const backgroundCallback of backgroundCallbackSet) {
      backgroundCallback();
    }
    timeout = setTimeout(update, 16); // roughly 60fps
  };
  return {
    start: () => {
      timeout = setTimeout(update, 16);
    },
    stop: () => {
      clearTimeout(timeout);
    },
  };
};
// For visual things we use animation frame which is more performant and made for this
const createAnimationFrameLoop = () => {
  let animationFrame = null;
  const update = () => {
    for (const visualCallback of visualCallbackSet) {
      visualCallback();
    }
    animationFrame = requestAnimationFrame(update);
  };
  return {
    start: () => {
      animationFrame = requestAnimationFrame(update);
    },
    stop: () => {
      cancelAnimationFrame(animationFrame);
    },
  };
};
const backgroundUpdateLoop = createBackgroundUpdateLoop();
const animationUpdateLoop = createAnimationFrameLoop();

let timelineIsRunning = false;
const startTimeline = () => {
  if (timelineIsRunning) {
    return;
  }
  timelineIsRunning = true;
  backgroundUpdateLoop.start();
  animationUpdateLoop.start();
};
startTimeline();

// Default lifecycle methods that do nothing
const LIFECYCLE_DEFAULT = {
  setup: () => {},
  pause: () => {},
  cancel: () => {},
  finish: () => {},
  updateTarget: () => {},
};

const transitionPausedByBreakpointWeakSet = createIterableWeakSet();
const onTransitionPausedByBreakpoint = (transition) => {
  transitionPausedByBreakpointWeakSet.add(transition);
  transition.channels.finish.add(cleanupTransitionPausedByBreakpoint);
  transition.channels.cancel.add(cleanupTransitionPausedByBreakpoint);
};
const cleanupTransitionPausedByBreakpoint = (transition) => {
  transitionPausedByBreakpointWeakSet.delete(transition);
};
window.resumeTransitions = () => {
  for (const transition of transitionPausedByBreakpointWeakSet) {
    transition.play();
  }
};

const combineTwoLifecycle = (lifecycleA, lifecycleB) => {
  if (!lifecycleA && !lifecycleB) {
    return LIFECYCLE_DEFAULT;
  }
  if (!lifecycleB) {
    return lifecycleA;
  }
  if (!lifecycleA) {
    return lifecycleB;
  }

  return {
    setup: (transition) => {
      const resultA = lifecycleA.setup?.(transition) || {};
      const resultB = lifecycleB.setup?.(transition) || {};
      return {
        from: resultA.from ?? resultB.from,
        update: (transition) => {
          resultA.update?.(transition);
          resultB.update?.(transition);
        },
        restore: () => {
          resultA.restore?.();
          resultB.restore?.();
        },
        teardown: () => {
          resultA.teardown?.();
          resultB.teardown?.();
        },
      };
    },
    pause: (transition) => {
      const resumeA = lifecycleA.pause?.(transition);
      const resumeB = lifecycleB.pause?.(transition);
      return () => {
        resumeA?.();
        resumeB?.();
      };
    },
    cancel: (transition) => {
      lifecycleA.cancel?.(transition);
      lifecycleB.cancel?.(transition);
    },
    finish: (transition) => {
      lifecycleA.finish?.(transition);
      lifecycleB.finish?.(transition);
    },
    updateTarget: (transition) => {
      lifecycleA.updateTarget?.(transition);
      lifecycleB.updateTarget?.(transition);
    },
  };
};

/**
 * Lifecycle object for managing transition behavior and DOM updates.
 *
 * The lifecycle pattern provides hooks for different transition phases:
 *
 * @typedef {Object} TransitionLifecycle
 * @property {Function} [setup] - Called when transition starts. Should return an object with:
 *   @property {number}   [from] - Override the transition's from value if transition.from is undefined
 *   @property {Function} [update] - Called on each frame with (transition) - handles DOM updates
 *   @property {Function} [restore] - Called when transition is cancelled - should reset DOM to original state
 *   @property {Function} [teardown] - Called when transition finishes or is cancelled - cleanup resources
 * @property {Function} [pause] - Called when transition is paused. Should return a resume function
 * @property {Function} [cancel] - Called when transition is cancelled
 * @property {Function} [finish] - Called when transition finishes naturally
 * @property {Function} [reverse] - Called when transition direction is reversed
 * @property {Function} [updateTarget] - Called when transition target is updated mid-flight
 *
 * @example
 * // Basic DOM animation lifecycle
 * const lifecycle = {
 *   setup: (transition) => {
 *     const element = document.getElementById('myElement');
 *     const originalWidth = element.style.width;
 *
 *     return {
 *       from: element.offsetWidth, // Override from value with current DOM state
 *       update: (transition) => {
 *         // Apply transition value to DOM on each frame
 *         element.style.width = `${transition.value}px`;
 *       },
 *       restore: () => {
 *         // Reset DOM when cancelled
 *         element.style.width = originalWidth;
 *       },
 *       teardown: () => {
 *         // Cleanup when done (remove temp styles, event listeners, etc.)
 *         element.style.width = '';
 *       }
 *     };
 *   },
 *   pause: (transition) => {
 *     // Handle pause logic if needed
 *     return () => {
 *       // Resume logic
 *     };
 *   }
 * };
 */
const createTransition = ({
  constructor,
  key,
  from,
  to,
  easing = EASING.EASE_OUT,
  startProgress = 0, // Progress to start from (0-1)
  baseLifecycle,
  onUpdate,
  onFinish,
  onPause,
  minDiff,
  debugQuarterBreakpoints = false, // Shorthand for debugBreakpoints: [0.25, 0.75]
  debugBreakpoints = debugQuarterBreakpoints ? [0.25, 0.75] : [], // Array of progress values (0-1) where debugger should trigger
  pauseBreakpoints = [],
  warnOnSmallDifferences = false,
  ...rest
} = {}) => {
  const [updateCallbacks, executeUpdateCallbacks] = createCallbackController();
  const [cancelCallbacks, executeCancelCallbacks] = createCallbackController();
  const [finishCallbacks, executeFinishCallbacks] = createCallbackController();
  const channels = {
    update: updateCallbacks,
    cancel: cancelCallbacks,
    finish: finishCallbacks,
  };

  const lifecycle = combineTwoLifecycle(baseLifecycle, rest.lifecycle);
  let breakpointMap;

  let playState = "idle"; // 'idle', 'running', 'paused', 'finished'
  let isFirstUpdate = false;
  let resume;
  let executionLifecycle = null;

  const start = () => {
    isFirstUpdate = true;
    playState = "running";

    executionLifecycle = lifecycle.setup?.(transition) || {};

    // Allow setup to override from value if transition.from is undefined
    if (
      transition.from === undefined &&
      executionLifecycle.from !== undefined
    ) {
      transition.from = executionLifecycle.from;
    }

    if (warnOnSmallDifferences) {
      const diff = Math.abs(transition.to - transition.from);
      if (diff === 0) {
        console.warn(
          `${constructor.name} transition has identical from and to values (${transition.from}). This transition will have no effect.`,
        );
      } else if (typeof minDiff === "number" && diff < minDiff) {
        console.warn(
          `${constructor.name} transition difference is very small (${diff}). Consider if this transition is necessary (minimum threshold: ${minDiff}).`,
        );
      }
    }
    transition.update(transition.startProgress);
  };

  const transition = {
    constructor,
    key,
    from,
    to,
    progress: startProgress,
    startProgress,
    easedProgress: easing ? easing(startProgress) : startProgress,
    easing,
    value: from,
    timing: "",
    channels,
    get playState() {
      return playState;
    },

    play: () => {
      if (playState === "idle") {
        transition.value = transition.from;
        transition.timing = "";
        transition.progress = transition.startProgress;
        breakpointMap = new Map();
        for (const debugBreakpoint of debugBreakpoints) {
          breakpointMap.set(debugBreakpoint, "debug");
        }
        for (const pauseBreakpoint of pauseBreakpoints) {
          breakpointMap.set(pauseBreakpoint, "pause");
        }
        start();
        return;
      }
      if (playState === "running") {
        console.warn("transition already running");
        return;
      }
      if (playState === "paused") {
        playState = "running";
        resume();
        return;
      }
      // "finished"
      start();
    },

    update: (inputProgress) => {
      if (playState === "idle") {
        console.warn("Cannot update transition that is idle");
        return;
      }
      if (playState === "finished") {
        console.warn("Cannot update a finished transition");
        return;
      }
      let progress;
      if (startProgress) {
        // Apply start progress offset - transition runs from startProgress to 1
        // Progress represents a ratio (0-1), so we can't just add ratios together
        // Instead, we need to map inputProgress to the remaining progress range (1 - startProgress)
        // This could also exceed 1 if we used simple addition, but that's just a symptom of the conceptual error
        // Example: startProgress=0.3, inputProgress=0.5 → 0.3 + 0.5*(1-0.3) = 0.65
        progress = startProgress + inputProgress * (1 - startProgress);
      } else {
        progress = inputProgress;
      }
      transition.progress = progress;

      const easedProgress = easing ? easing(progress) : progress;
      transition.easedProgress = easedProgress;

      const value = interpolate(transition, transition.from, transition.to);
      transition.value = value;

      transition.timing =
        progress === 1 ? "end" : isFirstUpdate ? "start" : "progress";
      isFirstUpdate = false;
      executionLifecycle.update?.(transition);
      executeUpdateCallbacks(transition);
      onUpdate?.(transition);

      for (const [breakpoint, effect] of breakpointMap) {
        if (progress >= breakpoint) {
          breakpointMap.delete(breakpoint);
          if (effect === "debug") {
            console.log(
              `Debug breakpoint hit at ${(breakpoint * 100).toFixed(1)}% progress`,
            );
            const notifyDebuggerEnd = notifyDebuggerStart();
            debugger;
            notifyDebuggerEnd();
          }
          if (effect === "pause") {
            transition.pause();
            onTransitionPausedByBreakpoint(transition);
          }
        }
      }
    },

    pause: () => {
      if (playState === "paused") {
        console.warn("transition already paused");
        return;
      }
      if (playState === "finished") {
        console.warn("Cannot pause a finished transition");
        return;
      }
      playState = "paused";

      // Let the transition handle its own pause logic
      resume = lifecycle.pause?.(transition);
      onPause?.(transition);
    },

    cancel: () => {
      if (executionLifecycle) {
        lifecycle.cancel?.(transition);
        executionLifecycle.teardown?.();
        executionLifecycle.restore?.();
      }
      resume = null;
      playState = "idle";
      executeCancelCallbacks(transition);
    },

    finish: () => {
      if (playState === "idle") {
        console.warn("Cannot finish a transition that is idle");
        return;
      }
      if (playState === "finished") {
        console.warn("transition already finished");
        return;
      }
      // "running" or "paused"
      lifecycle.finish?.(transition);
      executionLifecycle.teardown?.();
      resume = null;
      playState = "finished";
      executeFinishCallbacks(transition);
      onFinish?.(transition);
    },

    reverse: () => {
      if (playState === "idle") {
        console.warn("Cannot reverse a transition that is idle");
        return;
      }
      if (playState === "finished") {
        console.warn("Cannot reverse a finished transition");
        return;
      }

      // Simply swap from and to values to reverse direction
      const originalFrom = transition.from;
      const originalTo = transition.to;

      transition.from = originalTo;
      transition.to = originalFrom;

      // Let the transition handle its own reverse logic (if any)
      lifecycle.reverse?.(transition);
    },

    updateTarget: (newTarget) => {
      if (
        typeof newTarget !== "number" ||
        isNaN(newTarget) ||
        !isFinite(newTarget)
      ) {
        throw new Error(
          `updateTarget: newTarget must be a finite number, got ${newTarget}`,
        );
      }
      if (playState === "idle") {
        console.warn("Cannot update target of idle transition");
        return;
      }
      if (playState === "finished") {
        console.warn("Cannot update target of finished transition");
        return;
      }
      const currentValue = transition.value;
      transition.from = currentValue;
      transition.to = newTarget;

      // Let the transition handle its own target update logic
      lifecycle.updateTarget?.(transition);
    },

    ...rest,
  };

  return transition;
};

const interpolate = (transition, from, to) => {
  const { easedProgress } = transition;
  return applyRatioToDiff(from, to, easedProgress);
};
const applyRatioToDiff = (from, to, ratio) => {
  if (ratio === 0) {
    return from;
  }
  if (ratio === 1) {
    return to;
  }
  return from + (to - from) * ratio;
};

/**
 * Creates a timeline-managed transition that automatically handles animation timing
 * and integrates with the global animation timeline.
 *
 * @param {Object} options - Configuration options for the transition
 * @param {boolean} [options.isVisual] - Whether this is a visual transition (affects timeline priority)
 * @param {number} options.duration - Duration of the transition in milliseconds
 * @param {number} [options.fps=60] - Target frames per second for the animation
 * @param {Function} [options.easing=EASING.EASE_OUT] - Easing function to apply to progress
 * @param {Object} [options.lifecycle] - Lifecycle methods for the transition
 * @param {number} [options.startProgress=0] - Progress value to start from (0-1)
 * @param {number[]} [options.debugBreakpoints=[]] - Array of progress values (0-1) where debugger should trigger
 * @param {boolean} [options.debugQuarterBreakpoints=false] - If true and debugBreakpoints is empty, sets breakpoints at 0.25 and 0.75
 * @param {*} [...options] - Additional options passed to createTransition
 * @returns {Object} Timeline transition object with play(), pause(), cancel(), finish() methods
 */
// Timeline-managed transition that adds/removes itself from the animation timeline
const createTimelineTransition = ({
  isVisual,
  duration,
  fps = 60,
  easing = EASING.EASE_OUT,
  ...options
}) => {
  if (typeof duration !== "number" || duration <= 0) {
    throw new Error(
      `Invalid duration: ${duration}. Duration must be a positive number.`,
    );
  }

  let lastUpdateTime = -1;
  const timeChangeCallback = () => {
    const timelineCurrentTime = getTimelineCurrentTime();

    {
      const SUSPICIOUS_FRAME_DURATION_MS = 4000;
      // Detect frozen code (debugger, long pause) early
      // (not needed that much since introduce of debugBreakpoints option)
      const timeSinceLastUpdate =
        lastUpdateTime === -1
          ? timelineCurrentTime - transition.baseTime
          : timelineCurrentTime - lastUpdateTime;
      if (timeSinceLastUpdate > SUSPICIOUS_FRAME_DURATION_MS) {
        // Code was frozen for more than SUSPICIOUS_FRAME_DURATION (e.g. debugger)
        // Adjust baseTime to compensate for the freeze and update timing for next frame
        const freezeDuration = timeSinceLastUpdate - transition.frameDuration;
        transition.baseTime += freezeDuration;
        lastUpdateTime = timelineCurrentTime;
        return;
      }
    }

    const msElapsedSinceStart = timelineCurrentTime - transition.baseTime;
    const msRemaining = transition.duration - msElapsedSinceStart;

    if (
      // we reach the end, round progress to 1
      msRemaining < 0 ||
      // we are very close from the end, round progress to 1
      msRemaining <= transition.frameDuration
    ) {
      transition.frameRemainingCount = 0;
      transition.update(1);
      transition.finish();
      return;
    }

    if (lastUpdateTime === -1) ; else {
      const timeSinceLastUpdate = timelineCurrentTime - lastUpdateTime;

      // Allow rendering if we're within 3ms of the target frame duration
      // This prevents choppy animations when browser timing is slightly off
      const frameTimeTolerance = 3; // ms
      const targetFrameTime = transition.frameDuration - frameTimeTolerance;

      // Skip update only if we're significantly early
      if (timeSinceLastUpdate < targetFrameTime) {
        return;
      }
    }
    lastUpdateTime = timelineCurrentTime;
    transition.frameRemainingCount = Math.ceil(
      msRemaining / transition.frameDuration,
    );
    const progress = msElapsedSinceStart / transition.duration;
    transition.update(progress > 1 ? 1 : progress);
  };
  const onTimelineNeeded = () => {
    addOnTimeline(timeChangeCallback, isVisual);
  };
  const onTimelineNotNeeded = () => {
    removeFromTimeline(timeChangeCallback, isVisual);
  };

  const transition = createTransition({
    ...options,
    startTime: null,
    baseTime: null,
    duration,
    easing,
    fps,
    get frameDuration() {
      return 1000 / fps;
    },
    frameRemainingCount: 0,
    baseLifecycle: {
      setup: (transition) => {
        // Handle timeline management
        lastUpdateTime = -1;
        transition.baseTime = transition.startTime = getTimelineCurrentTime();
        // Calculate remaining frames based on remaining progress
        const remainingProgress = 1 - transition.progress;
        const remainingDuration = transition.duration * remainingProgress;
        transition.frameRemainingCount = Math.ceil(
          remainingDuration / transition.frameDuration,
        );
        onTimelineNeeded();
        const unsubscribeDebugger = subscribeDebugger(() => {
          transition.pause();
          return () => {
            // if we play() right after debugger
            // document.timeline.currentTime is still the same
            // and we can't adjust to the time ellapsed in the debugger session
            // we need to wait for the next js loop to have an updated
            // document.timeline.currentTime that takes into account the time spent in the debugger
            requestAnimationFrame(transition.play);
          };
        });
        return {
          teardown: () => {
            unsubscribeDebugger();
          },
        };
      },
      pause: (transition) => {
        const pauseTime = getTimelineCurrentTime();
        onTimelineNotNeeded();
        return () => {
          const pausedDuration = getTimelineCurrentTime() - pauseTime;
          transition.baseTime += pausedDuration;
          // Only adjust lastUpdateTime if it was set (not -1)
          if (lastUpdateTime !== -1) {
            lastUpdateTime += pausedDuration;
          }
          onTimelineNeeded();
        };
      },
      updateTarget: (transition) => {
        transition.baseTime = getTimelineCurrentTime();
        // Don't reset lastUpdateTime - we want visual continuity for smooth target updates
        // Recalculate remaining frames from current progress
        const remainingProgress = 1 - transition.progress;
        const remainingDuration = transition.duration * remainingProgress;
        transition.frameRemainingCount = Math.ceil(
          remainingDuration / transition.frameDuration,
        );
      },
      cancel: () => {
        onTimelineNotNeeded();
      },
      finish: () => {
        onTimelineNotNeeded();
      },
    },
  });
  return transition;
};

const createCallbackController = () => {
  const callbackSet = new Set();
  const execute = (...args) => {
    for (const callback of callbackSet) {
      callback(...args);
    }
  };
  const callbacks = {
    add: (callback) => {
      if (typeof callback !== "function") {
        throw new TypeError("Callback must be a function");
      }
      callbackSet.add(callback);
      return () => {
        callbackSet.delete(callback);
      };
    },
  };
  return [callbacks, execute];
};

/**
 * Creates an interface that manages ongoing transitions
 * and handles target updates automatically
 */
const createGroupTransitionController = (groupTransitionOptions) => {
  // Track all active transitions for cancellation and matching
  const activeTransitions = new Set();

  return {
    /**
     * Control multiple transitions simultaneously
     * Automatically handles updateTarget for transitions that match constructor + targetKey
     * @param {Array} transitions - Array of transition objects with constructor and targetKey properties
     * @param {Object} options - Transition options
     * @param {Function} options.onChange - Called with (changeEntries, isLast) during transition
     * @param {Function} options.onFinish - Called when all transitions complete
     * @param {Function} options.onCancel - Called when transitions are cancelled
     * @returns {Object} Playback controller with play(), pause(), cancel(), etc.
     */
    update: (transitions, options = {}) => {
      const { onChange, onCancel, onFinish } = options;

      if (transitions.length === 0) {
        // No transitions to animate, call onFinish immediately
        if (onFinish) {
          onFinish([]);
        }
        return {
          play: () => {},
          pause: () => {},
          cancel: () => {},
          finish: () => {},
          playState: "idle",
          channels: {
            update: { add: () => {} },
            cancel: { add: () => {} },
            finish: { add: () => {} },
          },
        };
      }

      const newTransitions = [];
      const updatedTransitions = [];

      // Separate transitions into new vs updates to existing ones
      for (const transition of transitions) {
        // Look for existing transition with same constructor and targetKey
        let existingTransition = null;
        for (const transitionCandidate of activeTransitions) {
          if (
            transitionCandidate.constructor === transition.constructor &&
            transitionCandidate.key === transition.key
          ) {
            existingTransition = transitionCandidate;
            break;
          }
        }

        if (existingTransition && existingTransition.playState === "running") {
          // Update the existing transition's target if it supports updateTarget
          if (existingTransition.updateTarget) {
            existingTransition.updateTarget(transition.to);
          }
          updatedTransitions.push(existingTransition);
        } else {
          // Track this new transition
          activeTransitions.add(transition);
          // Clean up tracking when transition finishes
          transition.channels.finish.add(() => {
            activeTransitions.delete(transition);
          });

          newTransitions.push(transition);
        }
      }

      // If we only have updated transitions (no new ones), return a minimal controller
      if (newTransitions.length === 0) {
        return {
          play: () => {}, // Already playing
          pause: () =>
            updatedTransitions.forEach((transition) => transition.pause()),
          cancel: () =>
            updatedTransitions.forEach((transition) => transition.cancel()),
          finish: () =>
            updatedTransitions.forEach((transition) => transition.finish()),
          reverse: () =>
            updatedTransitions.forEach((transition) => transition.reverse()),
          playState: "running", // All are already running
          channels: {
            update: { add: () => {} }, // Update tracking already set up
            cancel: { add: () => {} },
            finish: { add: () => {} },
          },
        };
      }

      // Create group transition to coordinate new transitions only
      const groupTransition = createGroupTransition(
        newTransitions,
        groupTransitionOptions,
      );

      // Add unified update tracking for ALL transitions (new + updated)
      if (onChange) {
        groupTransition.channels.update.add((transition) => {
          // Build change entries for current state of ALL transitions
          const changeEntries = [...newTransitions, ...updatedTransitions].map(
            (transition) => ({
              transition,
              value: transition.value,
            }),
          );

          const isLast = transition.value >= 1; // isLast = value >= 1 (since group tracks 0-1)
          onChange(changeEntries, isLast);
        });
      }

      if (onCancel) {
        groupTransition.channels.cancel.add(() => {
          const changeEntries = [...newTransitions, ...updatedTransitions].map(
            (transition) => ({
              transition,
              value: transition.value,
            }),
          );
          onCancel(changeEntries);
        });
      }

      // Add finish tracking
      if (onFinish) {
        groupTransition.channels.finish.add(() => {
          const changeEntries = [...newTransitions, ...updatedTransitions].map(
            (transition) => ({
              transition,
              value: transition.value,
            }),
          );
          onFinish(changeEntries);
        });
      }

      return groupTransition;
    },

    /**
     * Cancel all ongoing transitions managed by this controller
     */
    cancel: () => {
      // Cancel all active transitions
      for (const transition of activeTransitions) {
        if (
          transition.playState === "running" ||
          transition.playState === "paused"
        ) {
          transition.cancel();
        }
      }
      // Clear the sets - the finish callbacks will handle individual cleanup
      activeTransitions.clear();
    },
  };
};

// transition that manages multiple transitions
const createGroupTransition = (transitionArray, options = {}) => {
  let childCount = transitionArray.length;
  // duration is infered from the longest child transition
  let duration = 0;
  for (const childTransition of transitionArray) {
    if (childTransition.duration > duration) {
      duration = childTransition.duration;
    }
  }

  const groupTransition = createTransition({
    ...options,
    constructor: createGroupTransition,
    from: 0,
    to: 1,
    duration,
    baseLifecycle: {
      setup: (transition) => {
        let finishedCount = 0;

        const [cleanup, addCleanup] = createPubSub();

        for (const childTransition of transitionArray) {
          const removeFinishListener = childTransition.channels.finish.add(
            // eslint-disable-next-line no-loop-func
            () => {
              finishedCount++;
              const allFinished = finishedCount === childCount;
              if (allFinished) {
                transition.finish();
              }
            },
          );
          addCleanup(removeFinishListener);
          childTransition.play();

          const removeUpdateListener = childTransition.channels.update.add(
            () => {
              // Calculate average progress (handle undefined progress)
              let totalProgress = 0;
              let progressCount = 0;
              for (const t of transitionArray) {
                if (typeof t.progress === "number") {
                  totalProgress += t.progress;
                  progressCount++;
                }
              }
              const averageProgress =
                progressCount > 0 ? totalProgress / progressCount : 0;
              transition.update(averageProgress);
            },
          );
          addCleanup(removeUpdateListener);
        }

        return {
          teardown: cleanup,
        };
      },
      pause: () => {
        for (const childTransition of transitionArray) {
          if (childTransition.playState === "running") {
            childTransition.pause();
          }
        }
        return () => {
          for (const childTransition of transitionArray) {
            if (childTransition.playState === "paused") {
              childTransition.play();
            }
          }
        };
      },
      cancel: () => {
        for (const childTransition of transitionArray) {
          if (childTransition.playState !== "idle") {
            childTransition.cancel();
          }
        }
      },
      finish: () => {
        for (const childTransition of transitionArray) {
          if (childTransition.playState === "idle") {
            // child transition got canceled, keep it canceled
            continue;
          }
          if (childTransition.playState !== "finished") {
            childTransition.finish();
          }
        }
      },
      reverse: () => {
        for (const childTransition of transitionArray) {
          if (
            childTransition.playState === "running" ||
            childTransition.playState === "paused"
          ) {
            childTransition.reverse();
          }
        }
      },
    },
  });
  return groupTransition;
};

// Helper function to prepare color transition pairs, handling edge cases
const prepareRGBATransitionPair = (fromColor, toColor) => {
  const fromUnset = !fromColor;
  const toUnset = !toColor;

  // Both unset - no transition needed
  if (fromUnset && toUnset) {
    return null;
  }
  // Handle unset cases by using transparent versions
  if (fromUnset) {
    const toFullyTransparent = updateRGBA(toColor, { a: 0 });
    return [toFullyTransparent, toColor];
  }
  if (toUnset) {
    const fromFullyTransparent = updateRGBA(fromColor, { a: 0 });
    return [fromColor, fromFullyTransparent];
  }
  // Handle fully transparent cases
  const fromFullyTransparent = fromColor[3] === 0;
  const toFullyTransparent = toColor[3] === 0;
  if (fromFullyTransparent && toFullyTransparent) {
    return [fromColor, toColor];
  }
  if (fromFullyTransparent) {
    const toFullTransparent = updateRGBA(toColor, { a: 0 });
    return [toFullTransparent, toColor];
  }
  if (toFullyTransparent) {
    const fromFullyTransparent = updateRGBA(fromColor, { a: 0 });
    return [fromColor, fromFullyTransparent];
  }
  return [fromColor, toColor];
};
const interpolateRGBA = (transition, fromRGBA, toRGBA) => {
  const [rFrom, gFrom, bFrom, aFrom] = fromRGBA;
  const [rTo, gTo, bTo, aTo] = toRGBA;
  const r = interpolate(transition, rFrom, rTo);
  const g = interpolate(transition, gFrom, gTo);
  const b = interpolate(transition, bFrom, bTo);
  const a = interpolate(transition, aFrom, aTo);
  return [r, g, b, a];
};

const getBackgroundColorAndImageInterpolation = (
  fromBackground,
  toBackground,
) => {
  const fromBackgroundColor = fromBackground.color;
  const toBackgroundColor = toBackground.color;
  const fromBackgroundImage = fromBackground.image;
  const toBackgroundImage = toBackground.image;
  const fromHasImage = Boolean(fromBackgroundImage);
  const toHasImage = Boolean(toBackgroundImage);
  const fromHasGradient = fromHasImage && isGradientObject(fromBackgroundImage);
  const toHasGradient = toHasImage && isGradientObject(toBackgroundImage);
  const getInterpolateBackgroundColor = () => {
    const backgroundColorRgbaPair = prepareRGBATransitionPair(
      fromBackgroundColor,
      toBackgroundColor,
    );
    if (!backgroundColorRgbaPair) {
      return toBackgroundColor;
    }
    const [fromRGBA, toRGBA] = backgroundColorRgbaPair;
    return (transition) => {
      const rgbaInterpolated = interpolateRGBA(transition, fromRGBA, toRGBA);
      return rgbaInterpolated;
    };
  };

  // color to color
  if (!fromHasImage && !toHasImage) {
    return {
      color: getInterpolateBackgroundColor(),
    };
  }
  // gradient to color
  if (fromHasGradient && !toHasImage && toBackgroundColor) {
    if (!gradientHasColors(fromBackgroundImage)) {
      return { color: toBackgroundColor };
    }
    return {
      image: (transition) => {
        if (transition.value === 1) {
          return undefined;
        }
        const interpolatedColors = fromBackgroundImage.colors.map(
          (colorStop) => {
            return interpolateColorStopToColor(
              transition,
              colorStop,
              toBackgroundColor,
            );
          },
        );
        return { ...fromBackgroundImage, colors: interpolatedColors };
      },
      color: (transition) => {
        if (transition.value < 1) {
          return undefined;
        }
        return toBackgroundColor;
      },
    };
  }
  // color to gradient
  if (!fromHasImage && fromBackgroundColor && toHasGradient) {
    if (!gradientHasColors(toBackgroundImage)) {
      return { image: toBackgroundImage };
    }
    return {
      image: (transition) => {
        const interpolatedColors = toBackgroundImage.colors.map((colorStop) => {
          return interpolateColorToColorStop(
            transition,
            fromBackgroundColor,
            colorStop,
          );
        });
        return {
          ...toBackgroundImage,
          colors: interpolatedColors,
        };
      },
    };
  }
  // gradient to gradient
  if (fromHasGradient && toHasGradient) {
    if (
      !gradientHasColors(fromBackgroundImage) ||
      !gradientHasColors(toBackgroundImage)
    ) {
      // Unsupported cross-gradient transition - fall back to instant change
      return { image: toBackgroundImage };
    }
    const fromGradientType = fromBackgroundImage.type;
    const toGradientType = toBackgroundImage.type;
    const isSameGradientType = fromGradientType === toGradientType;
    const fromColors = fromBackgroundImage.colors;
    const toColors = toBackgroundImage.colors;
    return {
      image: (transition) => {
        const interpolatedColors = interpolateColorStopsArray(
          transition,
          fromColors,
          toColors,
          isSameGradientType ? "same-type" : "cross-type",
        );
        return {
          ...toBackgroundImage,
          colors: interpolatedColors,
        };
      },
      color: isSameGradientType
        ? getInterpolateBackgroundColor()
        : toBackgroundColor,
    };
  }
  return {
    color: getInterpolateBackgroundColor(),
  };
};

// Helper to interpolate color stops with position values
const interpolateStops = (transition, fromStops, toStops) => {
  if (!Array.isArray(fromStops) || !Array.isArray(toStops)) {
    return transition.value < 0.5 ? fromStops : toStops;
  }

  const maxLength = Math.max(fromStops.length, toStops.length);
  const result = [];
  for (let i = 0; i < maxLength; i++) {
    const fromStop = fromStops[i];
    const toStop = toStops[i];
    result.push(interpolateStop(transition, fromStop, toStop));
  }

  return result;
};

// Helper to interpolate a single stop (position value)
const interpolateStop = (transition, fromStop, toStop) => {
  if (fromStop && toStop) {
    // Stops are now already parsed objects
    if (
      fromStop.isNumeric &&
      toStop.isNumeric &&
      fromStop.unit === toStop.unit
    ) {
      const interpolatedValue = interpolate(
        transition,
        fromStop.value,
        toStop.value,
      );
      return {
        isNumeric: true,
        value: interpolatedValue,
        unit: fromStop.unit,
      };
    }
    // Non-numeric or different units - use threshold
    return transition.value < 0.5 ? fromStop : toStop;
  }
  // Only one exists - use it
  return fromStop || toStop;
};

// Helper to interpolate a single color stop between two color stops
const interpolateColorStop = (transition, fromStop, toStop) => {
  if (!fromStop || !toStop) {
    return toStop || fromStop;
  }

  const interpolatedStop = { ...toStop };

  // Interpolate colors if both exist
  if (fromStop.color && toStop.color) {
    interpolatedStop.color = interpolateRGBA(
      transition,
      fromStop.color,
      toStop.color,
    );
  }

  // Interpolate position stops if both exist
  if (fromStop.stops && toStop.stops) {
    interpolatedStop.stops = interpolateStops(
      transition,
      fromStop.stops,
      toStop.stops,
    );
  }

  return interpolatedStop;
};

// Helper to interpolate color stops arrays with different handling strategies
const interpolateColorStopsArray = (
  transition,
  fromColors,
  toColors,
  strategy = "same-type",
) => {
  const maxStops = Math.max(fromColors.length, toColors.length);
  const interpolatedColors = [];

  for (let i = 0; i < maxStops; i++) {
    const fromStop = fromColors[i];
    const toStop = toColors[i];

    if (fromStop && toStop) {
      if (strategy === "cross-type") {
        // For cross-gradient transitions, prioritize target structure
        const interpolatedStop = { ...toStop };
        if (fromStop.color && toStop.color) {
          interpolatedStop.color = interpolateRGBA(
            transition,
            fromStop.color,
            toStop.color,
          );
        }
        interpolatedColors.push(interpolatedStop);
      } else {
        // For same-type transitions, fully interpolate
        interpolatedColors.push(
          interpolateColorStop(transition, fromStop, toStop),
        );
      }
    } else if (toStop) {
      // Only target stop exists - use it as-is
      interpolatedColors.push(toStop);
    } else ;
    // Skip fromStop-only cases in cross transitions
  }

  return interpolatedColors;
};
const interpolateColorStopToColor = (transition, colorStop, targetColor) => {
  const colorStopColor = colorStop.color;
  if (!colorStopColor) {
    return colorStop;
  }
  const colorInterpolated = interpolateRGBA(
    transition,
    colorStopColor,
    targetColor,
  );
  return {
    ...colorStop,
    color: colorInterpolated,
  };
};

// Helper to interpolate from a source color toward a color stop
const interpolateColorToColorStop = (transition, sourceColor, colorStop) => {
  const colorStopColor = colorStop.color;
  if (!colorStopColor) {
    return colorStop;
  }
  const colorInterpolated = interpolateRGBA(
    transition,
    sourceColor,
    colorStopColor,
  );
  return {
    ...colorStop,
    color: colorInterpolated,
  };
};

// Helper functions for image object detection
const isGradientObject = (imageObj) => {
  return (
    imageObj &&
    typeof imageObj === "object" &&
    imageObj.type &&
    imageObj.type.includes("gradient")
  );
};

const gradientHasColors = (gradientObj) => {
  return (
    gradientObj.colors &&
    Array.isArray(gradientObj.colors) &&
    gradientObj.colors.length > 0
  );
};

const getBorderColorAndWidthInterpolation = (fromBorder, toBorder) => {
  // If one side has no color, use transparent as fallback
  const fromBorderColor = fromBorder?.color || [0, 0, 0, 0];
  const toBorderColor = toBorder?.color || [0, 0, 0, 0];
  const getInterpolateBorderColor = () => {
    // Handle cases where one or both colors are undefined (e.g., border: none)
    if (!fromBorderColor && !toBorderColor) {
      return null;
    }
    const borderColorRgbaPair = prepareRGBATransitionPair(
      fromBorderColor,
      toBorderColor,
    );
    if (!borderColorRgbaPair) {
      return toBorderColor;
    }
    const [fromRGBA, toRGBA] = borderColorRgbaPair;
    return (transition) => {
      const rgbaInterpolated = interpolateRGBA(transition, fromRGBA, toRGBA);
      return rgbaInterpolated;
    };
  };

  const fromWidth = fromBorder?.width || 0;
  const toWidth = toBorder?.width || 0;
  const getInterpolateBorderWidth = () => {
    return (transition) => interpolate(transition, fromWidth, toWidth);
  };

  return {
    color: getInterpolateBorderColor(),
    width: getInterpolateBorderWidth(),
  };
};

const createObjectInterpolation = (interpolation, from, to) => {
  if (interpolation === to) {
    if (from === to) {
      return null;
    }
    return to;
  }
  const propertyInterpolatorMap = new Map();
  for (const key of Object.keys(interpolation)) {
    const value = interpolation[key];
    if (value === to[key]) {
      continue;
    }
    const propertyInterpolator = (transition) => {
      const interpolatedValue = value(transition);
      return interpolatedValue;
    };
    propertyInterpolatorMap.set(key, propertyInterpolator);
  }
  if (propertyInterpolatorMap.size === 0) {
    return to;
  }
  const interpolateProperties = (transition) => {
    const toAssignMap = new Map();
    for (const [key, interpolate] of propertyInterpolatorMap) {
      const interpolatedValue = interpolate(transition);
      toAssignMap.set(key, interpolatedValue);
    }
    if (toAssignMap.size === 0) {
      return to;
    }
    const copy = { ...to };
    for (const [key, value] of toAssignMap) {
      if (value === undefined) {
        delete copy[key];
      } else {
        copy[key] = value;
      }
    }
    return copy;
  };
  return interpolateProperties;
};

const transitionStyleController = createStyleController("transition");

/**
 * Helper function to create CSS property transitions with common configuration
 * @param {Object} config - Configuration object
 * @param {Function} config.constructor - Constructor function for the transition
 * @param {HTMLElement} config.element - DOM element to animate
 * @param {number} config.to - Target value
 * @param {Function} config.getFrom - Function to get current property value
 * @param {string|Object} config.styleProperty - CSS property name or style object path
 * @param {number} [config.minDiff] - Minimum difference threshold for the transition
 * @param {Object} [config.options={}] - Additional options
 * @param {string} [config.options.styleSynchronizer="js_animation"] - How to apply transition ("js_animation", "inline_style", or "--css-var-name")
 * @returns {Object} Timeline transition object
 */
const createCSSPropertyTransition = ({
  element,
  getFrom,
  styleProperty,
  styleSynchronizer = "js_animation",
  getValue = (t) => t.value,
  lifecycle,
  ...options
}) => {
  if (typeof styleSynchronizer !== "string") {
    throw new Error("styleSynchronizer must be a string");
  }
  const setupSynchronizer = () => {
    if (styleSynchronizer === "inline_style") {
      return {
        update: (transition) => {
          const value = getValue(transition);
          if (typeof styleProperty === "string") {
            // Special handling for different CSS properties
            if (styleProperty === "opacity") {
              element.style[styleProperty] = value;
            } else {
              element.style[styleProperty] =
                typeof value === "number" ? `${value}px` : value;
            }
          } else {
            // Handle complex properties like transform.translateX
            const keys = styleProperty.split(".");
            if (keys[0] === "transform") {
              element.style.transform = `${keys[1]}(${value}px)`;
            }
          }
        },
        restore: () => {
          if (typeof styleProperty === "string") {
            element.style[styleProperty] = "";
          } else {
            const keys = styleProperty.split(".");
            if (keys[0] === "transform") {
              element.style.transform = "";
            }
          }
        },
      };
    }
    if (styleSynchronizer.startsWith("--")) {
      return {
        update: (transition) => {
          const value = getValue(transition);
          // Special handling for different CSS properties
          if (styleProperty === "opacity") {
            element.style.setProperty(styleSynchronizer, value);
          } else {
            element.style.setProperty(
              styleSynchronizer,
              typeof value === "number" ? `${value}px` : value,
            );
          }
        },
        restore: () => {
          element.style.removeProperty(styleSynchronizer);
        },
      };
    }
    if (styleSynchronizer.startsWith("[")) {
      const attributeName = styleSynchronizer.slice(1, -1);
      return {
        update: (transition) => {
          const value = getValue(transition);
          element.setAttribute(attributeName, value);
        },
        restore: () => {
          element.removeAttribute(attributeName);
        },
      };
    }
    return {
      update: (transition) => {
        const value = getValue(transition);

        if (typeof styleProperty === "string") {
          transitionStyleController.set(element, { [styleProperty]: value });
        } else {
          // Handle nested properties like transform.translateX
          const styleObj = {};
          const keys = styleProperty.split(".");
          if (keys.length === 2) {
            styleObj[keys[0]] = { [keys[1]]: value };
          }
          transitionStyleController.set(element, styleObj);
        }
      },
      restore: () => {
        transitionStyleController.delete(element, styleProperty);
      },
    };
  };

  return createTimelineTransition({
    duration: 300,
    ...options,
    key: element,
    isVisual: true,
    lifecycle: combineTwoLifecycle(
      {
        setup: () => {
          const from = getFrom(element);
          const synchronizer = setupSynchronizer();
          return {
            from,
            update: synchronizer.update,
            restore: synchronizer.restore,
          };
        },
      },
      lifecycle,
    ),
  });
};
const createNoopCSSPropertyTransition = ({ element, ...options }) => {
  return createTimelineTransition({
    duration: 300,
    ...options,
    key: element,
    isVisual: true,
    from: 0,
    to: 1,
  });
};
const createInstantCSSPropertyTransition = ({ element, value, ...options }) => {
  return createCSSPropertyTransition({
    ...options,
    element,
    getFrom: () => 0,
    from: 0,
    to: 1,
    getValue: () => value,
  });
};

const createWidthTransition = (element, to, options = {}) => {
  return createCSSPropertyTransition({
    ...options,
    constructor: createWidthTransition,
    element,
    styleProperty: "width",
    getFrom: getWidth$1,
    to,
    minDiff: 10,
  });
};
const createHeightTransition = (element, to, options = {}) => {
  return createCSSPropertyTransition({
    ...options,
    constructor: createHeightTransition,
    element,
    styleProperty: "height",
    getFrom: getHeight$1,
    to,
    minDiff: 10,
  });
};

const createOpacityTransition = (element, to, options = {}) => {
  return createCSSPropertyTransition({
    ...options,
    constructor: createOpacityTransition,
    element,
    styleProperty: "opacity",
    getFrom: getOpacity,
    to,
    minDiff: 0.1,
  });
};
const createTranslateXTransition = (element, to, options = {}) => {
  return createCSSPropertyTransition({
    ...options,
    constructor: createTranslateXTransition,
    element,
    styleProperty: "transform.translateX",
    getFrom: getTranslateX,
    to,
    minDiff: 10,
  });
};

const createBorderRadiusTransition = (element, to, options = {}) => {
  const from = Object.hasOwn(options, "from")
    ? parseStyle(options.from, "borderRadius")
    : undefined;
  to = parseStyle(to, "borderRadius");
  return createCSSPropertyTransition({
    ...options,
    constructor: createBorderRadiusTransition,
    element,
    styleProperty: "borderRadius",
    getFrom: getBorderRadius,
    from,
    to,
  });
};
const createBorderTransition = (element, to, options = {}) => {
  const fromBorder = Object.hasOwn(options, "from")
    ? parseStyle(options.from, "border", element)
    : getBorder(element);
  const toBorder = parseStyle(to, "border", element);
  let borderInterpolation;
  interpolation: {
    // Handle simple cases where no transition is possible
    if (!fromBorder && !toBorder) {
      borderInterpolation = toBorder;
      break interpolation;
    }
    const colorAndWidthInterpolation = getBorderColorAndWidthInterpolation(
      fromBorder,
      toBorder,
    );
    borderInterpolation = colorAndWidthInterpolation;
  }

  const interpolateBorder = createObjectInterpolation(
    borderInterpolation,
    fromBorder,
    toBorder,
  );
  if (!interpolateBorder) {
    return createNoopCSSPropertyTransition({
      element,
      ...options,
    });
  }
  return createCSSPropertyTransition({
    constructor: createBackgroundTransition,
    element,
    styleProperty: "border",
    from: 0,
    to: 1,
    getFrom: () => 0,
    getValue: (transition) => {
      const borderInterpolated = interpolateBorder(transition);
      const borderCSSValue = stringifyStyle(borderInterpolated, "border");
      return borderCSSValue;
    },
    ...options,
  });
};

const createBackgroundTransition = (element, to, options = {}) => {
  const fromBackground = options.from || getBackground(element);
  const toBackground = parseStyle(to, "background", element);
  let backgrounInterpolation;
  interpolation: {
    // Handle simple cases where no transition is possible
    if (!fromBackground && !toBackground) {
      backgrounInterpolation = toBackground;
      break interpolation;
    }
    if (
      typeof fromBackground !== "object" ||
      typeof toBackground !== "object" ||
      Array.isArray(fromBackground) ||
      Array.isArray(toBackground)
    ) {
      backgrounInterpolation = toBackground;
      break interpolation;
    }
    const colorAndImageInterpolation = getBackgroundColorAndImageInterpolation(
      fromBackground,
      toBackground,
    );
    backgrounInterpolation = colorAndImageInterpolation;
  }

  const interpolateBackground = createObjectInterpolation(
    backgrounInterpolation,
    fromBackground,
    toBackground,
  );
  if (!interpolateBackground) {
    return createNoopCSSPropertyTransition({
      element,
      ...options,
    });
  }
  if (interpolateBackground === toBackground) {
    const toStyleCss = stringifyStyle(to, "background");
    console.warn(
      `Unsupported background transition between "${stringifyStyle(fromBackground, "background")}" and "${toStyleCss}"`,
    );
    return createInstantCSSPropertyTransition({
      element,
      value: toStyleCss,
      ...options,
    });
  }
  return createCSSPropertyTransition({
    constructor: createBackgroundTransition,
    element,
    styleProperty: "background",
    from: 0,
    to: 1,
    getFrom: () => 0,
    getValue: (transition) => {
      const backgroundInterpolated = interpolateBackground(transition);
      return stringifyStyle(backgroundInterpolated, "background");
    },
    ...options,
  });
};
const createBackgroundColorTransition = (element, to, options = {}) => {
  const fromBackgroundColor = options.from || getBackgroundColor(element);
  const toBackgroundColor = parseStyle(to, "backgroundColor", element);
  const rgbaPair = prepareRGBATransitionPair(
    fromBackgroundColor,
    toBackgroundColor);
  if (!rgbaPair) {
    return createNoopCSSPropertyTransition({ element, ...options });
  }
  const [fromRgba, toRgba] = rgbaPair;
  if (areSameRGBA(fromRgba, toRgba)) {
    return createNoopCSSPropertyTransition({ element, ...options });
  }
  return createCSSPropertyTransition({
    ...options,
    constructor: createBackgroundColorTransition,
    element,
    styleProperty: "backgroundColor",
    getFrom: () => 0,
    from: 0,
    to: 1,
    getValue: (transition) => {
      const rgbaInterpolated = interpolateRGBA(transition, fromRgba, toRgba);
      const backgroundColorInterpolated = stringifyStyle(
        rgbaInterpolated,
        "backgroundColor",
      );
      return backgroundColorInterpolated;
    },
  });
};

// Helper functions for getting natural values
const getOpacityWithoutTransition = (element) =>
  getOpacity(element, transitionStyleController);
const getTranslateXWithoutTransition = (element) =>
  getTranslateX(element, transitionStyleController);
const getWidthWithoutTransition = (element) =>
  getWidth$1(element, transitionStyleController);
const getHeightWithoutTransition = (element) =>
  getHeight$1(element, transitionStyleController);

const getPaddingSizes = (element) => {
  const { paddingLeft, paddingRight, paddingTop, paddingBottom } =
    window.getComputedStyle(element, null);
  return {
    left: parseFloat(paddingLeft),
    right: parseFloat(paddingRight),
    top: parseFloat(paddingTop),
    bottom: parseFloat(paddingBottom),
  };
};

const getInnerHeight = (element) => {
  // Always subtract paddings and borders to get the content height
  const paddingSizes = getPaddingSizes(element);
  const borderSizes = getBorderSizes(element);
  const height = getHeight(element);
  const verticalSpaceTakenByPaddings = paddingSizes.top + paddingSizes.bottom;
  const verticalSpaceTakenByBorders = borderSizes.top + borderSizes.bottom;
  const innerHeight =
    height - verticalSpaceTakenByPaddings - verticalSpaceTakenByBorders;
  return innerHeight;
};

const getMarginSizes = (element) => {
  const { marginLeft, marginRight, marginTop, marginBottom } =
    window.getComputedStyle(element, null);
  return {
    left: parseFloat(marginLeft),
    right: parseFloat(marginRight),
    top: parseFloat(marginTop),
    bottom: parseFloat(marginBottom),
  };
};

const getAvailableHeight = (
  element,
  parentHeight = getHeight(element.parentElement),
) => {
  const parentElement = element.parentElement;
  const paddingSizes = getPaddingSizes(parentElement);
  const borderSizes = getBorderSizes(parentElement);
  let availableHeight = parentHeight;
  availableHeight -=
    paddingSizes.top +
    paddingSizes.bottom +
    borderSizes.top +
    borderSizes.bottom;
  if (availableHeight < 0) {
    availableHeight = 0;
  }
  return availableHeight;
};

const resolveCSSSize = (
  size,
  { availableSize, fontSize, autoIsRelativeToFont } = {},
) => {
  if (typeof size === "string") {
    if (size === "auto") {
      return autoIsRelativeToFont ? fontSize : availableSize;
    }
    if (size.endsWith("%")) {
      return availableSize * (parseFloat(size) / 100);
    }
    if (size.endsWith("px")) {
      return parseFloat(size);
    }
    if (size.endsWith("em")) {
      return parseFloat(size) * fontSize;
    }
    if (size.endsWith("rem")) {
      return (
        parseFloat(size) * getComputedStyle(document.documentElement).fontSize
      );
    }
    if (size.endsWith("vw")) {
      return (parseFloat(size) / 100) * window.innerWidth;
    }
    if (size.endsWith("vh")) {
      return (parseFloat(size) / 100) * window.innerHeight;
    }
    return parseFloat(size);
  }
  return size;
};

const getMinHeight = (element, availableHeight) => {
  const computedStyle = window.getComputedStyle(element);
  const { minHeight, fontSize } = computedStyle;
  return resolveCSSSize(minHeight, {
    availableSize:
      availableHeight === undefined
        ? getAvailableHeight(element)
        : availableHeight,
    fontSize,
  });
};

/**
 *
 *
 */


const HEIGHT_TRANSITION_DURATION = 300;
const ANIMATE_TOGGLE = true;
const ANIMATE_RESIZE_AFTER_MUTATION = true;
const ANIMATION_THRESHOLD_PX = 10; // Don't animate changes smaller than this
const DEBUG = false;

const initFlexDetailsSet = (
  container,
  {
    onSizeChange,
    onResizableDetailsChange,
    onMouseResizeEnd,
    onRequestedSizeChange,
    debug = DEBUG,
  } = {},
) => {
  const flexDetailsSet = {
    cleanup: null,
  };

  // Create animation controller for managing height animations
  const transitionController = createGroupTransitionController();

  const cleanupCallbackSet = new Set();
  const cleanup = () => {
    // Cancel any ongoing animations
    transitionController.cancel();

    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };
  flexDetailsSet.cleanup = cleanup;

  const spaceMap = new Map();
  const marginSizeMap = new Map();
  const requestedSpaceMap = new Map();
  const minSpaceMap = new Map();
  let allocatedSpaceMap = new Map();
  const canGrowSet = new Set();
  const canShrinkSet = new Set();
  let availableSpace;
  let remainingSpace;
  let lastChild;
  const openedDetailsArray = [];
  const spaceToSize = (space, element) => {
    const marginSize = marginSizeMap.get(element);
    return space - marginSize;
  };
  const sizeToSpace = (size, element) => {
    const marginSize = marginSizeMap.get(element);
    return size + marginSize;
  };
  const prepareSpaceDistribution = () => {
    spaceMap.clear();
    marginSizeMap.clear();
    requestedSpaceMap.clear();
    minSpaceMap.clear();
    allocatedSpaceMap.clear();
    canGrowSet.clear();
    canShrinkSet.clear();
    availableSpace = getInnerHeight(container);
    remainingSpace = availableSpace;
    openedDetailsArray.length = 0;
    lastChild = null;
    if (debug) {
      console.debug(`📐 Container space: ${availableSpace}px`);
    }

    for (const child of container.children) {
      lastChild = child;
      const marginSizes = getMarginSizes(child);
      const marginSize = marginSizes.top + marginSizes.bottom;
      marginSizeMap.set(child, marginSize);

      if (!isDetailsElement(child)) {
        const size = getHeight(child);
        spaceMap.set(child, size + marginSize);
        requestedSpaceMap.set(child, size + marginSize);
        minSpaceMap.set(child, size + marginSize);
        continue;
      }
      const details = child;
      let size;
      let requestedSize;
      let requestedSizeSource;
      let minSize;
      const summary = details.querySelector("summary");
      const summaryHeight = getHeight(summary);

      size = getHeight(details);

      if (details.open) {
        openedDetailsArray.push(details);
        canGrowSet.add(details);
        canShrinkSet.add(details);
        const detailsContent = summary.nextElementSibling;
        let detailsHeight;
        if (detailsContent) {
          const preserveScroll = captureScrollState(detailsContent);
          const restoreSizeStyle = forceStyles(detailsContent, {
            height: "auto",
          });
          const detailsContentHeight = getHeight(detailsContent);
          restoreSizeStyle();
          // Preserve scroll position after height manipulation
          preserveScroll();
          detailsHeight = summaryHeight + detailsContentHeight;
        } else {
          // empty details content like
          // <details><summary>...</summary></details>
          // or textual content like
          // <details><summary>...</summary>textual content</details>
          detailsHeight = size;
        }

        if (details.hasAttribute("data-requested-height")) {
          const requestedHeightAttribute = details.getAttribute(
            "data-requested-height",
          );
          requestedSize = resolveCSSSize(requestedHeightAttribute);
          if (isNaN(requestedSize) || !isFinite(requestedSize)) {
            console.warn(
              `details ${details.id} has invalid data-requested-height attribute: ${requestedHeightAttribute}`,
            );
          }
          requestedSizeSource = "data-requested-height attribute";
        } else {
          requestedSize = detailsHeight;
          requestedSizeSource = "summary and content height";
        }

        const dataMinHeight = details.getAttribute("data-min-height");
        if (dataMinHeight) {
          minSize = parseFloat(dataMinHeight, 10);
        } else {
          minSize = getMinHeight(details, availableSpace);
        }
      } else {
        requestedSize = summaryHeight;
        requestedSizeSource = "summary height";
        minSize = summaryHeight;
      }
      spaceMap.set(details, size + marginSize);
      requestedSpaceMap.set(details, requestedSize + marginSize);
      minSpaceMap.set(details, minSize + marginSize);
      if (debug) {
        const currentSizeFormatted = spaceToSize(size + marginSize, details);
        const requestedSizeFormatted = spaceToSize(
          requestedSize + marginSize,
          details,
        );
        const minSizeFormatted = spaceToSize(minSize + marginSize, details);
        console.debug(
          `  ${details.id}: ${currentSizeFormatted}px → wants ${requestedSizeFormatted}px (min: ${minSizeFormatted}px) [${requestedSizeSource}]`,
        );
      }
    }
  };

  const applyAllocatedSpaces = (resizeDetails) => {
    const changeSet = new Set();
    let maxChange = 0;

    for (const child of container.children) {
      const allocatedSpace = allocatedSpaceMap.get(child);
      const allocatedSize = spaceToSize(allocatedSpace, child);
      const space = spaceMap.get(child);
      const size = spaceToSize(space, child);
      const sizeChange = Math.abs(size - allocatedSize);

      if (size === allocatedSize) {
        continue;
      }

      // Track the maximum change to decide if animation is worth it
      maxChange = Math.max(maxChange, sizeChange);

      if (isDetailsElement(child) && child.open) {
        const syncDetailsContentHeight = prepareSyncDetailsContentHeight(child);
        changeSet.add({
          element: child,
          target: allocatedSize,
          sideEffect: (height, { isAnimationEnd } = {}) => {
            syncDetailsContentHeight(height, {
              isAnimation: true,
              isAnimationEnd,
            });
          },
        });
      } else {
        changeSet.add({
          element: child,
          target: allocatedSize,
        });
      }
    }

    if (changeSet.size === 0) {
      return;
    }

    // Don't animate if changes are too small (avoids imperceptible animations that hide scrollbars)
    const shouldAnimate =
      resizeDetails.animated && maxChange >= ANIMATION_THRESHOLD_PX;

    if (debug && resizeDetails.animated && !shouldAnimate) {
      console.debug(
        `🚫 Skipping animation: max change ${maxChange.toFixed(2)}px < ${ANIMATION_THRESHOLD_PX}px threshold`,
      );
    }

    if (!shouldAnimate) {
      const sizeChangeEntries = [];
      for (const { element, target, sideEffect } of changeSet) {
        element.style.height = `${target}px`;
        spaceMap.set(element, sizeToSpace(target, element));
        if (sideEffect) {
          sideEffect(target);
        }
        sizeChangeEntries.push({ element, value: target });
      }
      onSizeChange?.(sizeChangeEntries, resizeDetails);
      return;
    }

    // Create height animations for each element in changeSet
    const transitions = Array.from(changeSet).map(({ element, target }) => {
      const transition = createHeightTransition(element, target, {
        duration: HEIGHT_TRANSITION_DURATION,
      });
      return transition;
    });

    const transition = transitionController.animate(transitions, {
      onChange: (changeEntries, isLast) => {
        // Apply side effects for each animated element
        for (const { transition, value } of changeEntries) {
          for (const change of changeSet) {
            if (change.element === transition.key) {
              if (change.sideEffect) {
                change.sideEffect(value, { isAnimationEnd: isLast });
              }
              break;
            }
          }
        }

        if (onSizeChange) {
          // Convert animation entries to the expected format
          const sizeChangeEntries = changeEntries.map(
            ({ transition, value }) => ({
              element: transition.key, // targetKey is the element
              value,
            }),
          );
          onSizeChange(
            sizeChangeEntries,
            isLast ? { ...resizeDetails, animated: false } : resizeDetails,
          );
        }
      },
    });
    transition.play();
  };

  const allocateSpace = (child, spaceToAllocate, requestSource) => {
    const requestedSpace = requestedSpaceMap.get(child);
    const canShrink = canShrinkSet.has(child);
    const canGrow = canGrowSet.has(child);

    let allocatedSpace;
    let allocatedSpaceSource;
    allocate: {
      const minSpace = minSpaceMap.get(child);
      if (spaceToAllocate > remainingSpace) {
        if (remainingSpace < minSpace) {
          allocatedSpace = minSpace;
          allocatedSpaceSource = "min space";
          break allocate;
        }
        allocatedSpace = remainingSpace;
        allocatedSpaceSource = "remaining space";
        break allocate;
      }
      if (spaceToAllocate < minSpace) {
        allocatedSpace = minSpace;
        allocatedSpaceSource = "min space";
        break allocate;
      }
      allocatedSpace = spaceToAllocate;
      allocatedSpaceSource = requestSource;
      break allocate;
    }

    if (allocatedSpace < requestedSpace) {
      if (!canShrink) {
        allocatedSpace = requestedSpace;
        allocatedSpaceSource = `${requestSource} + cannot shrink`;
      }
    } else if (allocatedSpace > requestedSpace) {
      if (!canGrow) {
        allocatedSpace = requestedSpace;
        allocatedSpaceSource = `${requestSource} + cannot grow`;
      }
    }

    remainingSpace -= allocatedSpace;
    if (debug) {
      const allocatedSize = spaceToSize(allocatedSpace, child);
      const sourceInfo =
        allocatedSpaceSource === requestSource
          ? ""
          : ` (${allocatedSpaceSource})`;
      if (allocatedSpace === spaceToAllocate) {
        console.debug(
          `  → ${allocatedSize}px to "${child.id}"${sourceInfo} | ${remainingSpace}px remaining`,
        );
      } else {
        const requestedSize = spaceToSize(spaceToAllocate, child);
        console.debug(
          `  → ${allocatedSize}px -out of ${requestedSize}px wanted- to "${child.id}"${sourceInfo} | ${remainingSpace}px remaining`,
        );
      }
    }
    allocatedSpaceMap.set(child, allocatedSpace);

    const space = spaceMap.get(child);
    return allocatedSpace - space;
  };
  const applyDiffOnAllocatedSpace = (child, diff, source) => {
    if (diff === 0) {
      return 0;
    }
    const allocatedSpace = allocatedSpaceMap.get(child);
    remainingSpace += allocatedSpace;
    const spaceToAllocate = allocatedSpace + diff;
    if (debug) {
      console.debug(
        `🔄 ${child.id}: ${allocatedSpace}px + ${diff}px = ${spaceToAllocate}px (${source})`,
      );
    }
    allocateSpace(child, spaceToAllocate, source);
    const reallocatedSpace = allocatedSpaceMap.get(child);
    return reallocatedSpace - allocatedSpace;
  };
  const distributeAvailableSpace = (source) => {
    if (debug) {
      console.debug(
        `📦 Distributing ${availableSpace}px among ${container.children.length} children:`,
      );
    }
    for (const child of container.children) {
      allocateSpace(child, requestedSpaceMap.get(child), source);
    }
    if (debug) {
      console.debug(`📦 After distribution: ${remainingSpace}px remaining`);
    }
  };
  const distributeRemainingSpace = ({ childToGrow, childToShrinkFrom }) => {
    if (!remainingSpace) {
      return;
    }
    if (remainingSpace < 0) {
      const spaceToSteal = -remainingSpace;
      if (debug) {
        console.debug(
          `⚠️  Deficit: ${remainingSpace}px, stealing ${spaceToSteal}px from elements before ${childToShrinkFrom.id}`,
        );
      }
      updatePreviousSiblingsAllocatedSpace(
        childToShrinkFrom,
        -spaceToSteal,
        `remaining space is negative: ${remainingSpace}px`,
      );
      return;
    }
    if (childToGrow) {
      if (debug) {
        console.debug(
          `✨ Bonus: giving ${remainingSpace}px to ${childToGrow.id}`,
        );
      }
      applyDiffOnAllocatedSpace(
        childToGrow,
        remainingSpace,
        `remaining space is positive: ${remainingSpace}px`,
      );
    }
  };

  const updatePreviousSiblingsAllocatedSpace = (
    child,
    diffToApply,
    source,
    mapRemainingDiffToApply,
  ) => {
    let spaceDiffSum = 0;
    let remainingDiffToApply = diffToApply;
    let previousSibling = child.previousElementSibling;
    while (previousSibling) {
      const spaceDiff = applyDiffOnAllocatedSpace(
        previousSibling,
        remainingDiffToApply,
        source,
      );
      if (spaceDiff) {
        spaceDiffSum += spaceDiff;
        remainingDiffToApply -= spaceDiff;
        if (!remainingDiffToApply) {
          break;
        }
      }
      previousSibling = previousSibling.previousElementSibling;
    }
    return spaceDiffSum;
  };
  const updateNextSiblingsAllocatedSpace = (
    child,
    diffToApply,
    reason,
    mapRemainingDiffToApply,
  ) => {
    let spaceDiffSum = 0;
    let remainingDiffToApply = diffToApply;
    let nextSibling = child.nextElementSibling;
    while (nextSibling) {
      if (mapRemainingDiffToApply) {
        remainingDiffToApply = mapRemainingDiffToApply(
          nextSibling,
          remainingDiffToApply,
        );
      }
      const spaceDiff = applyDiffOnAllocatedSpace(
        nextSibling,
        remainingDiffToApply,
        reason,
      );
      if (spaceDiff) {
        spaceDiffSum += spaceDiff;
        remainingDiffToApply -= spaceDiff;
        if (!remainingDiffToApply) {
          break;
        }
      }
      nextSibling = nextSibling.nextElementSibling;
    }
    return spaceDiffSum;
  };
  const updateSiblingAllocatedSpace = (child, diff, reason) => {
    let nextSibling = child.nextElementSibling;
    while (nextSibling) {
      if (!isDetailsElement(nextSibling)) {
        nextSibling = nextSibling.nextElementSibling;
        continue;
      }
      const spaceDiff = applyDiffOnAllocatedSpace(nextSibling, diff, reason);
      if (spaceDiff) {
        return spaceDiff;
      }
      nextSibling = nextSibling.nextElementSibling;
    }
    if (debug) {
      console.debug(
        "coult not update next sibling allocated space, try on previous siblings",
      );
    }
    let previousSibling = child.previousElementSibling;
    while (previousSibling) {
      if (!isDetailsElement(previousSibling)) {
        previousSibling = previousSibling.previousElementSibling;
        continue;
      }
      const spaceDiff = applyDiffOnAllocatedSpace(
        previousSibling,
        diff,
        reason,
      );
      if (spaceDiff) {
        return spaceDiff;
      }
      previousSibling = previousSibling.previousElementSibling;
    }
    return 0;
  };

  const saveCurrentSizeAsRequestedSizes = ({
    replaceExistingAttributes,
  } = {}) => {
    for (const child of container.children) {
      if (canGrowSet.has(child) || canShrinkSet.has(child)) {
        if (
          child.hasAttribute("data-requested-height") &&
          !replaceExistingAttributes
        ) {
          continue;
        }
        const allocatedSpace = allocatedSpaceMap.get(child);
        child.setAttribute("data-requested-height", allocatedSpace);
      }
    }
  };

  const updateSpaceDistribution = (resizeDetails) => {
    if (debug) {
      console.group(`updateSpaceDistribution: ${resizeDetails.reason}`);
    }
    prepareSpaceDistribution();
    distributeAvailableSpace(resizeDetails.reason);
    distributeRemainingSpace({
      childToGrow: openedDetailsArray[openedDetailsArray.length - 1],
      childToShrinkFrom: lastChild,
    });
    if (
      resizeDetails.reason === "initial_space_distribution" ||
      resizeDetails.reason === "content_change"
    ) {
      spaceMap.clear(); // force to set size at start
    }
    applyAllocatedSpaces(resizeDetails);
    saveCurrentSizeAsRequestedSizes();
    if (debug) {
      console.groupEnd();
    }
  };

  const resizableDetailsIdSet = new Set();
  const updateResizableDetails = () => {
    const currentResizableDetailsIdSet = new Set();
    let hasPreviousOpen = false;
    for (const child of container.children) {
      if (!isDetailsElement(child)) {
        continue;
      }
      if (!child.open) {
        continue;
      }
      if (hasPreviousOpen) {
        currentResizableDetailsIdSet.add(child.id);
      }
      if (!hasPreviousOpen && child.open) {
        hasPreviousOpen = true;
      }
    }

    let someNew;
    let someOld;
    for (const currentId of currentResizableDetailsIdSet) {
      if (!resizableDetailsIdSet.has(currentId)) {
        resizableDetailsIdSet.add(currentId);
        someNew = true;
      }
    }
    for (const id of resizableDetailsIdSet) {
      if (!currentResizableDetailsIdSet.has(id)) {
        resizableDetailsIdSet.delete(id);
        someOld = true;
      }
    }
    if (someNew || someOld) {
      onResizableDetailsChange?.(resizableDetailsIdSet);
    }
  };

  {
    updateSpaceDistribution({
      reason: "initial_space_distribution",
    });
    updateResizableDetails();
  }

  {
    const distributeSpaceAfterToggle = (details) => {
      const reason = details.open
        ? `${details.id} just opened`
        : `${details.id} just closed`;
      if (debug) {
        console.group(`distributeSpaceAfterToggle: ${reason}`);
      }
      prepareSpaceDistribution();
      distributeAvailableSpace(reason);

      const requestedSpace = requestedSpaceMap.get(details);
      const allocatedSpace = allocatedSpaceMap.get(details);
      const spaceToSteal = requestedSpace - allocatedSpace - remainingSpace;
      if (spaceToSteal === 0) {
        distributeRemainingSpace({
          childToGrow: openedDetailsArray[openedDetailsArray.length - 1],
          childToShrinkFrom: lastChild,
        });
        return;
      }
      if (debug) {
        console.debug(
          `${details.id} would like to take ${requestedSpace}px (${reason}). Trying to steal ${spaceToSteal}px from sibling, remaining space: ${remainingSpace}px`,
        );
      }
      const spaceStolenFromSibling = -updateSiblingAllocatedSpace(
        details,
        -spaceToSteal,
        reason,
      );
      if (spaceStolenFromSibling) {
        if (debug) {
          console.debug(
            `${spaceStolenFromSibling}px space stolen from sibling`,
          );
        }
        applyDiffOnAllocatedSpace(details, requestedSpace, reason);
      } else {
        if (debug) {
          console.debug(
            `no space could be stolen from sibling, remaining space: ${remainingSpace}px`,
          );
        }
        distributeRemainingSpace({
          childToGrow: openedDetailsArray[0],
          childToShrinkFrom: lastChild,
        });
      }
      if (debug) {
        console.groupEnd();
      }
    };

    for (const child of container.children) {
      if (!isDetailsElement(child)) {
        continue;
      }
      const details = child;
      const ontoggle = () => {
        distributeSpaceAfterToggle(details);
        applyAllocatedSpaces({
          reason: details.open ? "details_opened" : "details_closed",
          animated: ANIMATE_TOGGLE,
        });
        updateResizableDetails();
      };
      if (details.open) {
        setTimeout(() => {
          details.addEventListener("toggle", ontoggle);
        });
      } else {
        details.addEventListener("toggle", ontoggle);
      }
      cleanupCallbackSet.add(() => {
        details.removeEventListener("toggle", ontoggle);
      });
    }
  }

  {
    const prepareResize = () => {
      let resizedElement;
      // let startSpaceMap;
      let startAllocatedSpaceMap;
      let currentAllocatedSpaceMap;

      const start = (element) => {
        updateSpaceDistribution({
          reason: "mouse_resize_start",
        });
        resizedElement = element;
        // startSpaceMap = new Map(spaceMap);
        startAllocatedSpaceMap = new Map(allocatedSpaceMap);
      };

      const applyMoveDiffToSizes = (moveDiff, reason) => {
        let spaceDiff = 0;
        let remainingMoveToApply;
        if (moveDiff > 0) {
          remainingMoveToApply = moveDiff;
          {
            // alors ici on veut grow pour tenter de restaurer la diff
            // entre requestedMap et spaceMap
            // s'il n'y en a pas alors on aura pas appliquer ce move
            const spaceGivenToNextSiblings = updateNextSiblingsAllocatedSpace(
              resizedElement,
              remainingMoveToApply,
              reason,
              (nextSibling) => {
                const requestedSpace = requestedSpaceMap.get(nextSibling);
                const space = spaceMap.get(nextSibling);
                return requestedSpace - space;
              },
            );
            if (spaceGivenToNextSiblings) {
              spaceDiff -= spaceGivenToNextSiblings;
              remainingMoveToApply -= spaceGivenToNextSiblings;
              if (debug) {
                console.debug(
                  `${spaceGivenToNextSiblings}px given to previous siblings`,
                );
              }
            }
          }
          {
            const spaceStolenFromPreviousSiblings =
              -updatePreviousSiblingsAllocatedSpace(
                resizedElement,
                -remainingMoveToApply,
                reason,
              );
            if (spaceStolenFromPreviousSiblings) {
              spaceDiff += spaceStolenFromPreviousSiblings;
              remainingMoveToApply -= spaceStolenFromPreviousSiblings;
              if (debug) {
                console.debug(
                  `${spaceStolenFromPreviousSiblings}px stolen from previous siblings`,
                );
              }
            }
          }
          {
            applyDiffOnAllocatedSpace(resizedElement, spaceDiff, reason);
          }
        }

        remainingMoveToApply = -moveDiff;
        {
          const selfShrink = -applyDiffOnAllocatedSpace(
            resizedElement,
            -remainingMoveToApply,
            reason,
          );
          remainingMoveToApply -= selfShrink;
          spaceDiff += selfShrink;
        }
        {
          const nextSiblingsShrink = -updateNextSiblingsAllocatedSpace(
            resizedElement,
            -remainingMoveToApply,
            reason,
          );
          if (nextSiblingsShrink) {
            remainingMoveToApply -= nextSiblingsShrink;
            spaceDiff += nextSiblingsShrink;
          }
        }
        {
          updatePreviousSiblingsAllocatedSpace(
            resizedElement,
            spaceDiff,
            reason,
          );
        }
      };

      const move = (yMove, gesture) => {
        // if (isNaN(moveRequestedSize) || !isFinite(moveRequestedSize)) {
        //   console.warn(
        //     `requestResize called with invalid size: ${moveRequestedSize}`,
        //   );
        //   return;
        // }
        const reason = `applying ${yMove}px move on ${resizedElement.id}`;
        if (debug) {
          console.group(reason);
        }

        const moveDiff = -yMove;
        applyMoveDiffToSizes(moveDiff, reason);
        applyAllocatedSpaces({
          reason: gesture.isMouseUp ? "mouse_resize_end" : "mouse_resize",
        });
        currentAllocatedSpaceMap = new Map(allocatedSpaceMap);
        allocatedSpaceMap = new Map(startAllocatedSpaceMap);
        if (debug) {
          console.groupEnd();
        }
      };

      const end = () => {
        if (currentAllocatedSpaceMap) {
          allocatedSpaceMap = currentAllocatedSpaceMap;
          saveCurrentSizeAsRequestedSizes({ replaceExistingAttributes: true });
          if (onRequestedSizeChange) {
            for (const [child, allocatedSpace] of allocatedSpaceMap) {
              const size = spaceToSize(allocatedSpace, child);
              onRequestedSizeChange(child, size);
            }
          }
          onMouseResizeEnd?.();
        }
      };

      return { start, move, end };
    };

    const onmousedown = (event) => {
      const { start, move, end } = prepareResize();

      startDragToResizeGesture(event, {
        onDragStart: (gesture) => {
          start(gesture.element);
        },
        onDrag: (gesture) => {
          const yMove = gesture.yMove;
          move(yMove, gesture);
        },
        onRelease: () => {
          end();
        },
        constrainedFeedbackLine: false,
      });
    };
    container.addEventListener("mousedown", onmousedown);
    cleanupCallbackSet.add(() => {
      container.removeEventListener("mousedown", onmousedown);
    });
  }

  {
    /**
     * In the following HTML browser will set `<div>` height as if it was "auto"
     *
     * ```html
     * <details style="height: 100px;">
     *   <summary>...</summary>
     *   <div style="height: 100%"></div>
     * </details>
     * ```
     *
     * So we always maintain a precise px height for the details content to ensure
     * it takes 100% of the details height (minus the summay)
     *
     * To achieve this we need to update these px heights when the container size changes
     */
    const resizeObserver = new ResizeObserver(() => {
      updateSpaceDistribution({
        reason: "container_resize",
      });
    });
    resizeObserver.observe(container);
    cleanupCallbackSet.add(() => {
      resizeObserver.disconnect();
    });
  }

  {
    // Track when the DOM structure changes inside the container
    // This detects when:
    // - Details elements are added/removed
    // - The content inside details elements changes
    const mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          updateSpaceDistribution({
            reason: "content_change",
            animated: ANIMATE_RESIZE_AFTER_MUTATION,
          });
          return;
        }
        if (mutation.type === "characterData") {
          updateSpaceDistribution({
            reason: "content_change",
            animated: ANIMATE_RESIZE_AFTER_MUTATION,
          });
          return;
        }
      }
    });
    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    cleanupCallbackSet.add(() => {
      mutationObserver.disconnect();
    });
  }

  return flexDetailsSet;
};

const prepareSyncDetailsContentHeight = (details) => {
  const getHeightCssValue = (height) => {
    return `${height}px`;
  };

  const summary = details.querySelector("summary");
  const summaryHeight = getHeight(summary);
  details.style.setProperty(
    "--summary-height",
    getHeightCssValue(summaryHeight),
  );

  const content = summary.nextElementSibling;
  if (!content) {
    return (detailsHeight) => {
      details.style.setProperty(
        "--details-height",
        getHeightCssValue(detailsHeight),
      );
      details.style.setProperty(
        "--content-height",
        getHeightCssValue(detailsHeight - summaryHeight),
      );
    };
  }

  // Capture scroll state at the beginning before any DOM manipulation
  const preserveScroll = captureScrollState(content);
  content.style.height = "var(--content-height)";

  const contentComputedStyle = getComputedStyle(content);
  const scrollbarMightTakeHorizontalSpace =
    contentComputedStyle.overflowY === "auto" &&
    contentComputedStyle.scrollbarGutter !== "stable";

  return (detailsHeight, { isAnimation, isAnimationEnd } = {}) => {
    const contentHeight = detailsHeight - summaryHeight;
    details.style.setProperty(
      "--details-height",
      getHeightCssValue(detailsHeight),
    );
    details.style.setProperty(
      "--content-height",
      getHeightCssValue(contentHeight),
    );

    if (!isAnimation || isAnimationEnd) {
      if (scrollbarMightTakeHorizontalSpace) {
        // Fix scrollbar induced overflow:
        //
        // 1. browser displays a scrollbar because there is an overflow inside overflow: auto
        // 2. we set height exactly to the natural height required to prevent overflow
        //
        // actual: browser keeps scrollbar displayed
        // expected: scrollbar is hidden
        //
        // Solution: Temporarily prevent scrollbar to display
        // force layout recalculation, then restore
        const restoreOverflow = forceStyles(content, {
          "overflow-y": "hidden",
        });
        // eslint-disable-next-line no-unused-expressions
        content.offsetHeight;
        restoreOverflow();
      }
    }

    // Preserve scroll position at the end after all DOM manipulations
    // The captureScrollState function is smart enough to handle new dimensions
    preserveScroll();
  };
};

const isDetailsElement = (element) => {
  return element && element.tagName === "DETAILS";
};

const getAvailableWidth = (
  element,
  parentWidth = getWidth(element.parentElement),
) => {
  const parentElement = element.parentElement;
  const paddingSizes = getPaddingSizes(parentElement);
  const borderSizes = getBorderSizes(parentElement);
  let availableWidth = parentWidth;
  availableWidth -=
    paddingSizes.left +
    paddingSizes.right +
    borderSizes.left +
    borderSizes.right;
  if (availableWidth < 0) {
    availableWidth = 0;
  }
  return availableWidth;
};

const getInnerWidth = (element) => {
  // Always subtract paddings and borders to get the content width
  const paddingSizes = getPaddingSizes(element);
  const borderSizes = getBorderSizes(element);
  const width = getWidth(element);
  const horizontalSpaceTakenByPaddings = paddingSizes.left + paddingSizes.right;
  const horizontalSpaceTakenByBorders = borderSizes.left + borderSizes.right;
  const innerWidth =
    width - horizontalSpaceTakenByPaddings - horizontalSpaceTakenByBorders;
  return innerWidth;
};

const getMaxHeight = (
  element,
  availableHeight = getAvailableHeight(element),
) => {
  let maxHeight = availableHeight;
  const marginSizes = getMarginSizes(element);
  maxHeight -= marginSizes.top;
  maxHeight -= marginSizes.bottom;

  const parentElement = element.parentElement;
  const parentElementComputedStyle = window.getComputedStyle(parentElement);
  if (
    parentElementComputedStyle.display === "flex" &&
    parentElementComputedStyle.flexDirection === "column"
  ) {
    let previousSibling = element.previousElementSibling;
    while (previousSibling) {
      if (canTakeSpace(previousSibling)) {
        const previousSiblingHeight = getHeight(previousSibling);
        maxHeight -= previousSiblingHeight;
        const previousSiblingMarginSizes = getMarginSizes(previousSibling);
        maxHeight -= previousSiblingMarginSizes.top;
        maxHeight -= previousSiblingMarginSizes.bottom;
      }
      previousSibling = previousSibling.previousElementSibling;
    }
    let nextSibling = element.nextElementSibling;
    while (nextSibling) {
      if (canTakeSpace(nextSibling)) {
        const nextSiblingMinHeight = getMinHeight(nextSibling, availableHeight);
        maxHeight -= nextSiblingMinHeight;
        const nextSiblingMarginSizes = getMarginSizes(nextSibling);
        maxHeight -= nextSiblingMarginSizes.top;
        maxHeight -= nextSiblingMarginSizes.bottom;
      }
      nextSibling = nextSibling.nextElementSibling;
    }
  }
  return maxHeight;
};

const canTakeSpace = (element) => {
  const computedStyle = window.getComputedStyle(element);

  if (computedStyle.display === "none") {
    return false;
  }
  if (computedStyle.position === "absolute") {
    return false;
  }
  return true;
};

const canTakeSize = (element) => {
  const computedStyle = window.getComputedStyle(element);

  if (computedStyle.display === "none") {
    return false;
  }
  if (computedStyle.position === "absolute") {
    return false;
  }
  return true;
};

const getMinWidth = (element, availableWidth) => {
  const computedStyle = window.getComputedStyle(element);
  const { minWidth, fontSize } = computedStyle;
  return resolveCSSSize(minWidth, {
    availableSize:
      availableWidth === undefined
        ? getAvailableWidth(element)
        : availableWidth,
    fontSize,
  });
};

const getMaxWidth = (
  element,
  availableWidth = getAvailableWidth(element),
) => {
  let maxWidth = availableWidth;

  const marginSizes = getMarginSizes(element);
  maxWidth -= marginSizes.left;
  maxWidth -= marginSizes.right;

  const parentElement = element.parentElement;
  const parentElementComputedStyle = window.getComputedStyle(parentElement);
  if (
    parentElementComputedStyle.display === "flex" &&
    parentElementComputedStyle.flexDirection === "row"
  ) {
    let previousSibling = element.previousElementSibling;
    while (previousSibling) {
      if (canTakeSize(previousSibling)) {
        const previousSiblingWidth = getWidth(previousSibling);
        maxWidth -= previousSiblingWidth;
        const previousSiblingMarginSizes = getMarginSizes(previousSibling);
        maxWidth -= previousSiblingMarginSizes.left;
        maxWidth -= previousSiblingMarginSizes.right;
      }
      previousSibling = previousSibling.previousElementSibling;
    }
    let nextSibling = element.nextElementSibling;
    while (nextSibling) {
      if (canTakeSize(nextSibling)) {
        const nextSiblingMinWidth = getMinWidth(nextSibling, availableWidth);
        maxWidth -= nextSiblingMinWidth;
        const nextSiblingMarginSizes = getMarginSizes(nextSibling);
        maxWidth -= nextSiblingMarginSizes.left;
        maxWidth -= nextSiblingMarginSizes.right;
      }
      nextSibling = nextSibling.nextElementSibling;
    }
  }
  return maxWidth;
};

const useAvailableHeight = (elementRef) => {
  const [availableHeight, availableHeightSetter] = useState(-1);

  useLayoutEffect(() => {
    const element = elementRef.current;
    const parentElement = element.parentElement;
    let raf;
    const resizeObserver = new ResizeObserver((entries) => {
      const [entry] = entries;
      const parentHeight = entry.contentRect.height;
      const availableH = getAvailableHeight(element, parentHeight);
      raf = requestAnimationFrame(() => {
        availableHeightSetter(availableH);
      });
    });
    resizeObserver.observe(parentElement);
    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return availableHeight;
};

const useAvailableWidth = (elementRef) => {
  const [availableWidth, availableWidthSetter] = useState(-1);

  useLayoutEffect(() => {
    const element = elementRef.current;
    const parentElement = element.parentElement;
    let raf;
    const resizeObserver = new ResizeObserver((entries) => {
      const [entry] = entries;
      const parentWidth = entry.contentRect.width;
      const availableW = getAvailableWidth(element, parentWidth);
      raf = requestAnimationFrame(() => {
        availableWidthSetter(availableW);
      });
    });
    resizeObserver.observe(parentElement);
    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return availableWidth;
};

const useMaxHeight = (elementRef, availableHeight) => {
  const element = elementRef.current;
  if (!element) {
    return -1;
  }
  const maxWidth = getMaxHeight(element, availableHeight);
  return maxWidth;
};

const useMaxWidth = (elementRef, availableWidth) => {
  const element = elementRef.current;
  if (!element) {
    return -1;
  }
  const maxWidth = getMaxWidth(element, availableWidth);
  return maxWidth;
};

const useResizeStatus = (elementRef, { as = "number" } = {}) => {
  const [resizing, setIsResizing] = useState(false);
  const [resizeWidth, setResizeWidth] = useState(null);
  const [resizeHeight, setResizeHeight] = useState(null);

  useLayoutEffect(() => {
    const element = elementRef.current;

    const onresizestart = (e) => {
      const sizeInfo = e.detail;
      setResizeWidth(
        as === "number" ? sizeInfo.width : sizeInfo.widthAsPercentage,
      );
      setResizeHeight(
        as === "number" ? sizeInfo.height : sizeInfo.heightAsPercentage,
      );
      setIsResizing(true);
    };
    const onresize = (e) => {
      const sizeInfo = e.detail;
      setResizeWidth(
        as === "number" ? sizeInfo.width : sizeInfo.widthAsPercentage,
      );
      setResizeHeight(
        as === "number" ? sizeInfo.height : sizeInfo.heightAsPercentage,
      );
    };
    const onresizeend = () => {
      setIsResizing(false);
    };

    element.addEventListener("resizestart", onresizestart);
    element.addEventListener("resize", onresize);
    element.addEventListener("resizeend", onresizeend);
    return () => {
      element.removeEventListener("resizestart", onresizestart);
      element.removeEventListener("resize", onresize);
      element.removeEventListener("resizeend", onresizeend);
    };
  }, [as]);

  return {
    resizing,
    resizeWidth,
    resizeHeight,
  };
};

export { EASING, activeElementSignal, addActiveElementEffect, addAttributeEffect, allowWheelThrough, appendStyles, canInterceptKeys, captureScrollState, createBackgroundColorTransition, createBackgroundTransition, createBorderRadiusTransition, createBorderTransition, createDragGestureController, createDragToMoveGestureController, createGroupTransitionController, createHeightTransition, createIterableWeakSet, createOpacityTransition, createPubSub, createStyleController, createTimelineTransition, createTransition, createTranslateXTransition, createValueEffect, createWidthTransition, cubicBezier, dragAfterThreshold, elementIsFocusable, elementIsVisibleForFocus, elementIsVisuallyVisible, findAfter, findAncestor, findBefore, findDescendant, findFocusable, getAvailableHeight, getAvailableWidth, getBackground, getBackgroundColor, getBorder, getBorderRadius, getBorderSizes, getContrastRatio, getDefaultStyles, getDragCoordinates, getDropTargetInfo, getElementSignature, getFirstVisuallyVisibleAncestor, getFocusVisibilityInfo, getHeight, getHeightWithoutTransition, getInnerHeight, getInnerWidth, getLuminance, getMarginSizes, getMaxHeight, getMaxWidth, getMinHeight, getMinWidth, getOpacity, getOpacityWithoutTransition, getPaddingSizes, getPositionedParent, getPreferedColorScheme, getScrollBox, getScrollContainer, getScrollContainerSet, getScrollRelativeRect, getSelfAndAncestorScrolls, getStyle, getTranslateX, getTranslateXWithoutTransition, getTranslateY, getVisuallyVisibleInfo, getWidth, getWidthWithoutTransition, hasCSSSizeUnit, initFlexDetailsSet, initFocusGroup, initPositionSticky, isScrollable, measureScrollbar, mergeOneStyle, mergeTwoStyles, normalizeStyles, parseStyle, pickLightOrDark, pickPositionRelativeTo, prefersDarkColors, prefersLightColors, preventFocusNav, preventFocusNavViaKeyboard, preventIntermediateScrollbar, resolveCSSColor, resolveCSSSize, resolveColorLuminance, setAttribute, setAttributes, setStyles, startDragToResizeGesture, stickyAsRelativeCoords, stringifyStyle, trapFocusInside, trapScrollInside, useActiveElement, useAvailableHeight, useAvailableWidth, useMaxHeight, useMaxWidth, useResizeStatus, visibleRectEffect };
