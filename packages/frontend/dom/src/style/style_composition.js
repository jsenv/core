import { parseCSSTransform, stringifyCSSTransform } from "./style_parsing.js";

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
export const mergeOneStyle = (existingValue, newValue, propertyName) => {
  if (propertyName === "transform") {
    // Parse transform strings automatically
    const parsedNew =
      typeof newValue === "string" && newValue !== "none"
        ? parseCSSTransform(newValue)
        : newValue;
    const parsedExisting =
      typeof existingValue === "string" && existingValue !== "none"
        ? parseCSSTransform(existingValue)
        : existingValue;

    if (typeof parsedNew === "object" && parsedNew !== null) {
      if (typeof parsedExisting === "object" && parsedExisting !== null) {
        const merged = { ...parsedExisting, ...parsedNew };
        // Return as string for CSS application
        return stringifyCSSTransform(merged);
      }
      return stringifyCSSTransform(parsedNew);
    }
  }

  // For all other properties, simple replacement
  return newValue;
};
