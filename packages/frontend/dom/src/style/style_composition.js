import { parseCSSTransform, stringifyCSSTransform } from "./style_parsing.js";

// Parse a matrix transform and extract simple transform components when possible
const parseMatrixTransform = (matrixString) => {
  // Match matrix() or matrix3d() functions
  const matrixMatch = matrixString.match(/matrix(?:3d)?\(([^)]+)\)/);
  if (!matrixMatch) return null;

  const values = matrixMatch[1].split(",").map((v) => parseFloat(v.trim()));

  if (matrixString.includes("matrix3d")) {
    // matrix3d(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p)
    if (values.length !== 16) return null;

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
  } else {
    // matrix(a, b, c, d, e, f)
    if (values.length !== 6) return null;
    const [a, b, c, d, e, f] = values;
    return parseSimple2DMatrix(a, b, c, d, e, f);
  }

  return null; // Complex 3D transform, can't simplify
};

// Parse a simple 2D matrix into transform components
const parseSimple2DMatrix = (a, b, c, d, e, f) => {
  const result = {};

  // Extract translation (always present in matrix)
  if (e !== 0) result.translateX = e;
  if (f !== 0) result.translateY = f;

  // Check for simple cases without rotation/skew
  if (b === 0 && c === 0) {
    // Pure scale and/or translate
    if (a !== 1) result.scaleX = a;
    if (d !== 1) result.scaleY = d;
    return result;
  }

  // Check for pure rotation (no scale or skew)
  const det = a * d - b * c;
  if (Math.abs(det - 1) < 0.0001 && Math.abs(a * a + b * b - 1) < 0.0001) {
    // This is a pure rotation
    const angle = Math.atan2(b, a) * (180 / Math.PI);
    if (Math.abs(angle) > 0.0001) {
      result.rotate = Math.round(angle * 1000) / 1000; // Round to avoid floating point issues
    }
    return result;
  }

  // Complex transform, return null to keep as matrix
  return null;
};

// Simplify a transform string by converting matrix to simple functions when possible
const simplifyTransform = (transformString) => {
  if (!transformString || transformString === "none") {
    return transformString;
  }

  // Check if it contains matrix functions
  const matrixRegex = /matrix(?:3d)?\([^)]+\)/g;
  const matrices = transformString.match(matrixRegex);

  if (!matrices) {
    return transformString; // No matrices to simplify
  }

  let simplified = transformString;

  for (const matrix of matrices) {
    const parsed = parseMatrixTransform(matrix);
    if (parsed && Object.keys(parsed).length > 0) {
      // Convert parsed components back to CSS functions
      const simpleFunctions = [];
      if (parsed.translateX !== undefined)
        simpleFunctions.push(`translateX(${parsed.translateX}px)`);
      if (parsed.translateY !== undefined)
        simpleFunctions.push(`translateY(${parsed.translateY}px)`);
      if (parsed.scaleX !== undefined)
        simpleFunctions.push(`scaleX(${parsed.scaleX})`);
      if (parsed.scaleY !== undefined)
        simpleFunctions.push(`scaleY(${parsed.scaleY})`);
      if (parsed.rotate !== undefined)
        simpleFunctions.push(`rotate(${parsed.rotate}deg)`);

      if (simpleFunctions.length > 0) {
        simplified = simplified.replace(matrix, simpleFunctions.join(" "));
      }
    }
  }

  return simplified;
};

// Merge two style objects, handling special cases like transform
export const mergeStyles = (stylesA, stylesB) => {
  const result = { ...stylesA };
  for (const key of Object.keys(stylesB)) {
    if (key === "transform") {
      result[key] = mergeOneStyle(stylesA[key], stylesB[key], key);
    } else {
      result[key] = stylesB[key];
    }
  }
  return result;
};

// Merge a single style property value with an existing value
export const mergeOneStyle = (
  existingValue,
  newValue,
  propertyName,
  context = "js",
) => {
  if (propertyName === "transform") {
    // Simplify matrix transforms in existing value before processing
    const simplifiedExisting =
      typeof existingValue === "string"
        ? simplifyTransform(existingValue)
        : existingValue;

    // Determine the types early (using simplified existing value)
    const existingIsString =
      typeof simplifiedExisting === "string" && simplifiedExisting !== "none";
    const newIsString = typeof newValue === "string" && newValue !== "none";
    const existingIsObject =
      typeof simplifiedExisting === "object" && simplifiedExisting !== null;
    const newIsObject = typeof newValue === "object" && newValue !== null;

    // Case 1: Both are objects - merge directly
    if (existingIsObject && newIsObject) {
      const merged = { ...simplifiedExisting, ...newValue };
      return context === "css" ? stringifyCSSTransform(merged) : merged;
    }

    // Case 2: New is object, existing is string - parse existing and merge
    if (newIsObject && existingIsString) {
      const parsedExisting = parseCSSTransform(simplifiedExisting);
      const merged = { ...parsedExisting, ...newValue };
      return context === "css" ? stringifyCSSTransform(merged) : merged;
    }

    // Case 3: New is string, existing is object - parse new and merge
    if (newIsString && existingIsObject) {
      const parsedNew = parseCSSTransform(newValue);
      const merged = { ...simplifiedExisting, ...parsedNew };
      return context === "css" ? stringifyCSSTransform(merged) : merged;
    }

    // Case 4: Both are strings - parse both and merge
    if (existingIsString && newIsString) {
      const parsedExisting = parseCSSTransform(simplifiedExisting);
      const parsedNew = parseCSSTransform(newValue);
      const merged = { ...parsedExisting, ...parsedNew };
      return context === "css" ? stringifyCSSTransform(merged) : merged;
    }

    // Case 5: New is object, no existing or existing is none/null
    if (newIsObject) {
      return context === "css" ? stringifyCSSTransform(newValue) : newValue;
    }

    // Case 6: New is string, no existing or existing is none/null
    if (newIsString) {
      if (context === "css") {
        return newValue; // Already a string
      }
      return parseCSSTransform(newValue); // Convert to object
    }
  }

  // For all other properties, simple replacement
  return newValue;
};
