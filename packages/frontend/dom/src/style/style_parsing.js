// Normalize styles for DOM application
export const normalizeStyles = (styles, context = "object") => {
  const normalized = {};
  for (const [key, value] of Object.entries(styles)) {
    if (key === "transform") {
      if (context === "css" && typeof value === "object" && value !== null) {
        // For CSS context, ensure transform is a string
        normalized[key] = stringifyCSSTransform(value);
      } else if (
        context === "object" &&
        typeof value === "string" &&
        value !== "none"
      ) {
        // For object context, prefer objects
        normalized[key] = parseCSSTransform(value);
      } else {
        normalized[key] = value;
      }
    } else {
      normalized[key] = value;
    }
  }
  return normalized;
};

// Convert transform object to CSS string
export const stringifyCSSTransform = (transformObj) => {
  const transforms = [];

  for (const [prop, value] of Object.entries(transformObj)) {
    if (value !== undefined && value !== null) {
      transforms.push(`${prop}(${value})`);
    }
  }

  return transforms.join(" ");
};

// Parse transform CSS string into object
export const parseCSSTransform = (transformString) => {
  const transformObj = {};

  if (!transformString || transformString === "none") {
    return transformObj;
  }

  // Simple regex to parse transform functions
  const transformPattern = /(\w+)\(([^)]+)\)/g;
  let match;

  while ((match = transformPattern.exec(transformString)) !== null) {
    const [, functionName, value] = match;
    transformObj[functionName] = value.trim();
  }

  return transformObj;
};
