import { parseTransformString } from "./style_parsing.js";

// Helper function to handle transform parsing in mergeStyles
const parseTransformIfNeeded = (value) => {
  if (typeof value === "string" && value !== "none") {
    return parseTransformString(value);
  }
  return value;
};

// Merge two style objects, handling special cases like transform
export const mergeStyles = (target, source) => {
  const result = { ...target };

  for (const [key, value] of Object.entries(source)) {
    if (key === "transform") {
      // Parse transform strings automatically
      const parsedValue = parseTransformIfNeeded(value);
      const parsedTarget = parseTransformIfNeeded(result.transform);

      if (typeof parsedValue === "object" && parsedValue !== null) {
        // Handle transform object merging
        if (typeof parsedTarget === "object" && parsedTarget !== null) {
          result.transform = { ...parsedTarget, ...parsedValue };
        } else {
          result.transform = { ...parsedValue };
        }
      } else {
        result.transform = parsedValue;
      }
    } else if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      // Handle other nested objects
      if (typeof result[key] === "object" && result[key] !== null) {
        result[key] = { ...result[key], ...value };
      } else {
        result[key] = { ...value };
      }
    } else {
      // Simple value assignment
      result[key] = value;
    }
  }

  return result;
};
