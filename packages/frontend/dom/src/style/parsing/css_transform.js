// Convert transform object to CSS string
export const stringifyCSSTransform = (transformObj, normalize) => {
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
export const parseCSSTransform = (transformString, normalize) => {
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
