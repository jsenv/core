// Merge two style objects, handling special cases like transform
export const mergeStyles = (target, source) => {
  const result = { ...target };

  for (const [key, value] of Object.entries(source)) {
    if (key === "transform" && typeof value === "object" && value !== null) {
      // Handle transform object merging
      if (typeof result.transform === "object" && result.transform !== null) {
        result.transform = { ...result.transform, ...value };
      } else {
        result.transform = { ...value };
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
