export const SYMBOL_IDENTITY = Symbol.for("navi_object_identity");

export const compareTwoJsValues = (a, b, seenSet = new Set()) => {
  if (a === b) {
    return true;
  }
  const aIsIsTruthy = Boolean(a);
  const bIsTruthy = Boolean(b);
  if (aIsIsTruthy && !bIsTruthy) {
    return false;
  }
  if (!aIsIsTruthy && !bIsTruthy) {
    // null, undefined, 0, false, NaN
    if (isNaN(a) && isNaN(b)) {
      return true;
    }
    return a === b;
  }
  const aType = typeof a;
  const bType = typeof b;
  if (aType !== bType) {
    return false;
  }
  const aIsPrimitive = aType !== "object" && aType !== "function";
  const bIsPrimitive = bType !== "object" && bType !== "function";
  if (aIsPrimitive !== bIsPrimitive) {
    return false;
  }
  if (aIsPrimitive && bIsPrimitive) {
    return a === b;
  }
  if (seenSet.has(a)) {
    return false;
  }
  if (seenSet.has(b)) {
    return false;
  }
  seenSet.add(a);
  seenSet.add(b);
  const aIsArray = Array.isArray(a);
  const bIsArray = Array.isArray(b);
  if (aIsArray !== bIsArray) {
    return false;
  }
  if (aIsArray) {
    // compare arrays
    if (a.length !== b.length) {
      return false;
    }
    let i = 0;
    while (i < a.length) {
      const aValue = a[i];
      const bValue = b[i];
      if (!compareTwoJsValues(aValue, bValue, seenSet)) {
        return false;
      }
      i++;
    }
    return true;
  }
  // compare objects
  const aIdentity = a[SYMBOL_IDENTITY];
  const bIdentity = b[SYMBOL_IDENTITY];
  if (aIdentity === bIdentity) {
    return true;
  }
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  for (const key of aKeys) {
    const aValue = a[key];
    const bValue = b[key];
    if (!compareTwoJsValues(aValue, bValue, seenSet)) {
      return false;
    }
  }
  return true;
};
