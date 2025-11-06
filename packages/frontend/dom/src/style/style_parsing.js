// Properties that need px units
const pxProperties = [
  "width",
  "height",
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
  "border",
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
];

// Properties that need deg units
const degProperties = [
  "rotate",
  "rotateX",
  "rotateY",
  "rotateZ",
  "skew",
  "skewX",
  "skewY",
];

// Properties that should remain unitless
const unitlessProperties = [
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
  "lineHeight", // Special case: unitless lineHeight is a multiplier relative to font-size
];

// Well-known CSS units and keywords that indicate a value already has proper formatting
const cssSizeUnitSet = new Set([
  "px",
  "em",
  "rem",
  "ex",
  "ch",
  "vw",
  "vh",
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
const cssKeywordSet = new Set([
  // Keywords that shouldn't get units
  "auto",
  "none",
  "inherit",
  "initial",
  "unset",
  "revert",
]);

// Check if value already has a unit or is a keyword
const hasUnit = (value) => {
  for (const cssUnit of cssUnitSet) {
    if (value.endsWith(cssUnit)) {
      return true;
    }
  }
  return false;
};
const isKeyword = (value) => {
  return cssKeywordSet.has(value);
};

// url(
// linear-gradient(
// radial-gradient(
// ...
const STARTS_WITH_CSS_IMAGE_FUNCTION_REGEX = /^[a-z-]+\(/;
// Normalize a single style value
export const normalizeStyle = (value, propertyName, context = "js") => {
  if (propertyName === "transform") {
    if (context === "js") {
      if (typeof value === "string") {
        // For js context, prefer objects
        return parseCSSTransform(value);
      }
      // If code does transform: { translateX: "10px" }
      // we want to store { translateX: 10 }
      const transformNormalized = {};
      for (const key of Object.keys(value)) {
        const partValue = normalizeStyle(value[key], key, "js");
        transformNormalized[key] = partValue;
      }
      return transformNormalized;
    }
    if (typeof value === "object" && value !== null) {
      // For CSS context, ensure transform is a string
      return stringifyCSSTransform(value);
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
      const parsedTransform = parseCSSTransform(value);
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
    if (context === "css") {
      if (
        typeof value === "string" &&
        !isKeyword(value) &&
        !STARTS_WITH_CSS_IMAGE_FUNCTION_REGEX.test(value)
      ) {
        return `url(${value})`;
      }
    }
    return value;
  }

  if (pxProperties.includes(propertyName)) {
    return normalizeNumber(value, {
      propertyName,
      unit: "px",
      preferedType: context === "js" ? "number" : "string",
    });
  }
  if (degProperties.includes(propertyName)) {
    return normalizeNumber(value, {
      propertyName,
      unit: "deg",
      preferedType: "string",
    });
  }
  if (unitlessProperties.includes(propertyName)) {
    return normalizeNumber(value, {
      propertyName,
      unit: "",
      preferedType: context === "js" ? "number" : "string",
    });
  }

  return value;
};
const normalizeNumber = (value, { unit, propertyName, preferedType }) => {
  if (typeof value === "string") {
    // Keep strings as-is (including %, em, rem, auto, none, etc.)
    if (preferedType === "string") {
      if (unit && !hasUnit(value) && !isKeyword(value)) {
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
export const normalizeStyles = (styles, context = "js", mutate = false) => {
  if (!styles) {
    return mutate ? styles : {};
  }
  if (typeof styles === "string") {
    styles = parseStyleString(styles);
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
export const parseStyleString = (styleString, context = "js") => {
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

// Convert transform object to CSS string
export const stringifyCSSTransform = (transformObj) => {
  const transforms = [];
  for (const key of Object.keys(transformObj)) {
    const transformPartValue = transformObj[key];
    const normalizedTransformPartValue = normalizeStyle(
      transformPartValue,
      key,
      "css",
    );
    transforms.push(`${key}(${normalizedTransformPartValue})`);
  }
  return transforms.join(" ");
};

// Parse transform CSS string into object
export const parseCSSTransform = (transformString) => {
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
    const normalizedValue = normalizeStyle(value.trim(), functionName, "js");
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
