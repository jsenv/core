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
  "lineHeight",
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
];

// Normalize a single style value
export const normalizeStyle = (value, propertyName, context = "js") => {
  if (propertyName === "transform") {
    if (context === "js") {
      if (typeof value === "string") {
        // For js context, prefer objects
        return parseCSSTransform(value);
      }
      return value;
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
        return undefined;
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

  if (pxProperties.includes(propertyName)) {
    return normalizeNumber(value, context, "px");
  }
  if (degProperties.includes(propertyName)) {
    return normalizeNumber(value, context, "deg");
  }
  if (unitlessProperties.includes(propertyName)) {
    return normalizeNumber(value, context, "");
  }

  return value;
};
const normalizeNumber = (value, context, unit) => {
  if (context === "css") {
    if (typeof value === "number") {
      return `${value}${unit}`;
    }
    return value;
  }
  if (typeof value === "string") {
    if (value === "auto") {
      return "auto";
    }
    const numericValue = parseFloat(value);
    if (isNaN(numericValue)) {
      // console.warn
      return value;
    }
    return numericValue;
  }
  return value;
};

// Normalize styles for DOM application
export const normalizeStyles = (styles, context = "js") => {
  const normalized = {};
  for (const [key, value] of Object.entries(styles)) {
    normalized[key] = normalizeStyle(value, key, context);
  }
  return normalized;
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
  if (e !== 0) result.translateX = e;
  if (f !== 0) result.translateY = f;

  // Check for simple cases without rotation/skew
  if (b === 0 && c === 0) {
    // Pure scale and/or translate - only add if not default (1)
    if (a !== 1) result.scaleX = a;
    if (d !== 1) result.scaleY = d;
    return result;
  }

  // Check for pure rotation (no scale or skew)
  const det = a * d - b * c;
  if (Math.abs(det - 1) < 0.0001 && Math.abs(a * a + b * b - 1) < 0.0001) {
    // This is a pure rotation - only add if not default (0)
    const angle = Math.atan2(b, a) * (180 / Math.PI);
    if (Math.abs(angle) > 0.0001) {
      result.rotate = Math.round(angle * 1000) / 1000; // Round to avoid floating point issues
    }
    return result;
  }

  // Complex transform, return null to keep as matrix
  return null;
};
