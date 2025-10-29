import {
  normalizeStyle,
  normalizeStyles,
  parseCSSTransform,
  stringifyCSSTransform,
} from "./style_parsing.js";

// Merge two style objects, handling special cases like transform
export const mergeStyles = (stylesA, stylesB, context = "js") => {
  if (!stylesA) {
    return normalizeStyles(stylesB, context);
  }
  if (!stylesB) {
    return normalizeStyles(stylesA, context);
  }
  const result = {};
  const aKeys = Object.keys(stylesA);
  const bKeyToVisitSet = new Set(Object.keys(stylesB));
  for (const aKey of aKeys) {
    const bHasKey = bKeyToVisitSet.has(aKey);
    if (bHasKey) {
      bKeyToVisitSet.delete(aKey);
      result[aKey] = mergeOneStyle(stylesA[aKey], stylesB[aKey], aKey, context);
    } else {
      result[aKey] = normalizeStyle(stylesA[aKey], aKey, context);
    }
  }
  for (const bKey of bKeyToVisitSet) {
    result[bKey] = normalizeStyle(stylesB[bKey], bKey, context);
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
    // Matrix parsing is now handled automatically in parseCSSTransform

    // Determine the types
    const existingIsString =
      typeof existingValue === "string" && existingValue !== "none";
    const newIsString = typeof newValue === "string" && newValue !== "none";
    const existingIsObject =
      typeof existingValue === "object" && existingValue !== null;
    const newIsObject = typeof newValue === "object" && newValue !== null;

    // Case 1: Both are objects - merge directly
    if (existingIsObject && newIsObject) {
      const merged = { ...existingValue, ...newValue };
      return context === "css" ? stringifyCSSTransform(merged) : merged;
    }

    // Case 2: New is object, existing is string - parse existing and merge
    if (newIsObject && existingIsString) {
      const parsedExisting = parseCSSTransform(existingValue);
      const merged = { ...parsedExisting, ...newValue };
      return context === "css" ? stringifyCSSTransform(merged) : merged;
    }

    // Case 3: New is string, existing is object - parse new and merge
    if (newIsString && existingIsObject) {
      const parsedNew = parseCSSTransform(newValue);
      const merged = { ...existingValue, ...parsedNew };
      return context === "css" ? stringifyCSSTransform(merged) : merged;
    }

    // Case 4: Both are strings - parse both and merge
    if (existingIsString && newIsString) {
      const parsedExisting = parseCSSTransform(existingValue);
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
