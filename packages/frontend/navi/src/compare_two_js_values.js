/**
 * Deep equality comparison for JavaScript values with cycle detection and identity optimization.
 *
 * This function performs a comprehensive deep comparison between two JavaScript values,
 * handling all primitive types, objects, arrays, and edge cases that standard equality
 * operators miss.
 *
 * Key features:
 * - **Deep comparison**: Recursively compares nested objects and arrays
 * - **Cycle detection**: Prevents infinite loops with circular references
 * - **Identity optimization**: Uses SYMBOL_IDENTITY for fast comparison of objects with same identity
 * - **Edge case handling**: Properly handles NaN, null, undefined, 0, false comparisons
 * - **Type safety**: Ensures both values have same type before deep comparison
 *
 * Performance optimizations:
 * - Early exit for reference equality (a === b)
 * - Identity symbol check for objects (avoids deep comparison when possible)
 * - Efficient array length check before element-by-element comparison
 *
 * Use cases:
 * - Memoization cache key comparison ({ id: 1 } should equal { id: 1 })
 * - React/Preact dependency comparison for effects and memos
 * - State change detection in signals and stores
 * - Action parameter comparison for avoiding duplicate requests
 *
 * Examples:
 * ```js
 * compareTwoJsValues({ id: 1 }, { id: 1 }) // true
 * compareTwoJsValues([1, 2, 3], [1, 2, 3]) // true
 * compareTwoJsValues(NaN, NaN) // true (unlike === which gives false)
 * compareTwoJsValues({ a: { b: 1 } }, { a: { b: 1 } }) // true
 *
 * // Identity optimization
 * const obj1 = { id: 1 };
 * const obj2 = { id: 1 };
 * obj1[SYMBOL_IDENTITY] = obj2[SYMBOL_IDENTITY] = Symbol('same');
 * compareTwoJsValues(obj1, obj2) // true (fast path, no deep comparison)
 * ```
 *
 * @param {any} a - First value to compare
 * @param {any} b - Second value to compare
 * @param {Set} seenSet - Internal cycle detection set (automatically managed)
 * @returns {boolean} true if values are deeply equal, false otherwise
 */

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
  if (aIdentity === bIdentity && SYMBOL_IDENTITY in a && SYMBOL_IDENTITY in b) {
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
