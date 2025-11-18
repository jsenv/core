import {
  parseCSSTransform,
  stringifyCSSTransform,
} from "./parsing/css_transform.js";
import {
  parseCSSWillChange,
  stringifyCSSWillChange,
} from "./parsing/css_will_change.js";
import { normalizeStyle, normalizeStyles } from "./parsing/style_parsing.js";

// Merge two style objects, handling special cases like transform
export const mergeTwoStyles = (stylesA, stylesB, context = "js") => {
  if (!stylesA) {
    return normalizeStyles(stylesB, context);
  }
  if (!stylesB) {
    return normalizeStyles(stylesA, context);
  }
  const result = {};
  const aKeys = Object.keys(stylesA);
  // in case stylesB is a string we first parse it
  stylesB = normalizeStyles(stylesB, context);
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
    result[bKey] = stylesB[bKey];
  }
  return result;
};

export const appendStyles = (
  stylesAObject,
  stylesBNormalized,
  context = "js",
) => {
  const aKeys = Object.keys(stylesAObject);
  const bKeys = Object.keys(stylesBNormalized);
  for (const bKey of bKeys) {
    const aHasKey = aKeys.includes(bKey);
    if (aHasKey) {
      stylesAObject[bKey] = mergeOneStyle(
        stylesAObject[bKey],
        stylesBNormalized[bKey],
        bKey,
        context,
      );
    } else {
      stylesAObject[bKey] = stylesBNormalized[bKey];
    }
  }
  return stylesAObject;
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
      return context === "css"
        ? stringifyCSSTransform(merged, normalizeStyle)
        : merged;
    }

    // Case 2: New is object, existing is string - parse existing and merge
    if (newIsObject && existingIsString) {
      const parsedExisting = parseCSSTransform(existingValue, normalizeStyle);
      const merged = { ...parsedExisting, ...newValue };
      return context === "css"
        ? stringifyCSSTransform(merged, normalizeStyle)
        : merged;
    }

    // Case 3: New is string, existing is object - parse new and merge
    if (newIsString && existingIsObject) {
      const parsedNew = parseCSSTransform(newValue, normalizeStyle);
      const merged = { ...existingValue, ...parsedNew };
      return context === "css"
        ? stringifyCSSTransform(merged, normalizeStyle)
        : merged;
    }

    // Case 4: Both are strings - parse both and merge
    if (existingIsString && newIsString) {
      const parsedExisting = parseCSSTransform(existingValue);
      const parsedNew = parseCSSTransform(newValue);
      const merged = { ...parsedExisting, ...parsedNew };
      return context === "css"
        ? stringifyCSSTransform(merged, normalizeStyle)
        : merged;
    }

    // Case 5: New is object, no existing or existing is none/null
    if (newIsObject) {
      return context === "css"
        ? stringifyCSSTransform(newValue, normalizeStyle)
        : newValue;
    }

    // Case 6: New is string, no existing or existing is none/null
    if (newIsString) {
      if (context === "css") {
        return newValue; // Already a string
      }
      return parseCSSTransform(newValue, normalizeStyle); // Convert to object
    }
    return newValue;
  }

  if (propertyName === "willChange") {
    const existingIsString = typeof existingValue === "string";
    const newIsString = typeof newValue === "string";
    const existingIsArray = Array.isArray(existingValue);
    const newIsArray = Array.isArray(newValue);

    // Case 1: Both are arrays - merge directly
    if (existingIsArray && newIsArray) {
      const merged = [...new Set([...existingValue, ...newValue])];
      if (context === "css") {
        return stringifyCSSWillChange(merged);
      }
      return merged;
    }

    // Case 2: New is array, existing is string - parse existing and merge
    if (newIsArray && existingIsString) {
      const existingArray = parseCSSWillChange(existingValue);
      const merged = [...new Set([...existingArray, ...newValue])];
      if (context === "css") {
        return stringifyCSSWillChange(merged);
      }
      return merged;
    }

    // Case 3: New is string, existing is array - parse new and merge
    if (newIsString && existingIsArray) {
      const newArray = parseCSSWillChange(newValue);
      const merged = [...new Set([...existingValue, ...newArray])];
      if (context === "css") {
        return stringifyCSSWillChange(merged);
      }
      return merged;
    }

    // Case 4: Both are strings - parse both and merge
    if (existingIsString && newIsString) {
      const existingArray = parseCSSWillChange(existingValue);
      const newArray = parseCSSWillChange(newValue);
      const merged = [...new Set([...existingArray, ...newArray])];
      if (context === "css") {
        return stringifyCSSWillChange(merged);
      }
      return merged;
    }

    // Case 5: New is array, no existing or existing is null/undefined
    if (newIsArray) {
      if (context === "css") {
        return stringifyCSSWillChange(newValue);
      }
      return newValue;
    }

    // Case 6: New is string, no existing or existing is null/undefined
    if (newIsString) {
      if (context === "css") {
        return newValue;
      }
      const parsed = parseCSSWillChange(newValue);
      return parsed;
    }
    // Fallback: return newValue as is
    return newValue;
  }

  // For all other properties, simple replacement
  return newValue;
};
