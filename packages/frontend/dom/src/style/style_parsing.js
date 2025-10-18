// Normalize styles for DOM application
export const normalizeStyles = (styles) => {
  const normalized = {};

  for (const [key, value] of Object.entries(styles)) {
    if (key === "transform" && typeof value === "object" && value !== null) {
      normalized[key] = transformObjectToString(value);
    } else {
      normalized[key] = value;
    }
  }

  return normalized;
};

// Convert transform object to CSS string
const transformObjectToString = (transformObj) => {
  const transforms = [];

  for (const [prop, value] of Object.entries(transformObj)) {
    if (value !== undefined && value !== null) {
      switch (prop) {
        case "translateX":
        case "translateY":
        case "translateZ":
          transforms.push(`${prop}(${value})`);
          break;
        case "rotate":
        case "rotateX":
        case "rotateY":
        case "rotateZ":
          transforms.push(`${prop}(${value})`);
          break;
        case "scale":
        case "scaleX":
        case "scaleY":
        case "scaleZ":
          transforms.push(`${prop}(${value})`);
          break;
        case "skew":
        case "skewX":
        case "skewY":
          transforms.push(`${prop}(${value})`);
          break;
        default:
          transforms.push(`${prop}(${value})`);
      }
    }
  }

  return transforms.join(" ");
};
