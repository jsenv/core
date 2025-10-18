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
  // Handle transform.* properties (e.g., "transform.translateX")
  if (propertyName.startsWith("transform.")) {
    const transformProperty = propertyName.slice(10); // Remove "transform." prefix

    if (context === "js" && typeof value === "string") {
      // Convert string values to numbers in js context
      const numericValue = parseFloat(value);
      if (isNaN(numericValue)) {
        return transformProperty.includes("scale") ? 1 : 0;
      }
      return numericValue;
    }
    if (context === "css" && typeof value === "number") {
      if (pxProperties.includes(transformProperty)) {
        return `${value}px`;
      }
      if (degProperties.includes(transformProperty)) {
        return `${value}deg`;
      }
      // "scale" remain unitless
      return value;
    }
    return value;
  }

  // Handle regular CSS properties
  if (context === "css" && typeof value === "number") {
    // For CSS context, add appropriate units based on property name
    if (pxProperties.includes(propertyName)) {
      return `${value}px`;
    }
    if (degProperties.includes(propertyName)) {
      return `${value}deg`;
    }
    if (unitlessProperties.includes(propertyName)) {
      return value;
      // Keep as number for unitless properties
    }
    // Default: add px for numeric values (safe assumption for most CSS)
    return `${value}px`;
  }

  // For "js" context with string values, try to convert to numbers when appropriate
  if (context === "js" && typeof value === "string") {
    // Try to parse numeric values for properties that should be numbers
    if (
      pxProperties.includes(propertyName) ||
      degProperties.includes(propertyName) ||
      unitlessProperties.includes(propertyName)
    ) {
      const numericValue = parseFloat(value);
      if (!isNaN(numericValue)) {
        return numericValue;
      }
    }
  }

  // For "js" context, keep numbers as-is (preferred for internal representation)
  // For non-numeric values, pass through unchanged

  if (propertyName === "transform") {
    if (context === "css" && typeof value === "object" && value !== null) {
      // For CSS context, ensure transform is a string
      return stringifyCSSTransform(value);
    }
    if (context === "js" && typeof value === "string" && value !== "none") {
      // For js context, prefer objects
      return parseCSSTransform(value);
    }
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
