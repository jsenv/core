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
  // Handle smart value conversion based on property name and context
  if (context === "css" && typeof value === "number") {
    // For CSS context, add appropriate units based on property name
    if (pxProperties.includes(propertyName)) {
      value = `${value}px`;
    } else if (degProperties.includes(propertyName)) {
      value = `${value}deg`;
    } else if (unitlessProperties.includes(propertyName)) {
      // Keep as number for unitless properties
    } else {
      // Default: add px for numeric values (safe assumption for most CSS)
      value = `${value}px`;
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
