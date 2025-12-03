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
 * **SYMBOL_IDENTITY explained**:
 * This symbol allows recognizing objects as "conceptually the same" even when they are
 * different object instances. When two objects share the same SYMBOL_IDENTITY value,
 * they are considered equal without performing deep comparison.
 *
 * This is particularly useful for:
 * - Copied objects that should be treated as the same entity
 * - Objects reconstructed from serialization that represent the same data
 * - Parameters passed through spread operator: `{ ...originalParams, newProp: value }`
 * - Memoization scenarios where object content identity matters more than reference identity
 *
 * Use cases:
 * - Memoization cache key comparison ({ id: 1 } should equal { id: 1 })
 * - React/Preact dependency comparison for effects and memos
 * - State change detection in signals and stores
 * - Action parameter comparison for avoiding duplicate requests
 * - Object recognition across serialization/deserialization boundaries
 *
 * Examples:
 * ```js
 * // Standard deep comparison
 * compareTwoJsValues({ id: 1 }, { id: 1 }) // true (slow - deep comparison)
 *
 * // NaN edge case handling
 * compareTwoJsValues(NaN, NaN) // true (unlike === which gives false)
 *
 * // Identity optimization - objects are different instances but same identity
 * const originalParams = { userId: 123, filters: ['active'] };
 * const copiedParams = { ...originalParams, newFlag: true };
 *
 * // Without SYMBOL_IDENTITY: slow deep comparison every time
 * compareTwoJsValues(originalParams, copiedParams) // false (different content)
 *
 * // With SYMBOL_IDENTITY: fast path recognition
 * const sharedIdentity = Symbol('params-identity');
 * originalParams[SYMBOL_IDENTITY] = sharedIdentity;
 * copiedParams[SYMBOL_IDENTITY] = sharedIdentity;
 *
 * compareTwoJsValues(originalParams, copiedParams) // true (fast - identity match)
 * // ↑ This returns true immediately without comparing all properties
 *
 * // Real-world scenario: action memoization
 * const params1 = { userId: 123 };
 * const action1 = createAction(params1);
 *
 * const params2 = { ...params1, extra: 'data' }; // Different object reference
 * params2[SYMBOL_IDENTITY] = params1[SYMBOL_IDENTITY]; // Same conceptual identity
 *
 * const action2 = createAction(params2);
 * // action1 === action2 because params are recognized as conceptually identical
 * ```
 *
 * @param {any} a - First value to compare
 * @param {any} b - Second value to compare
 * @param {Set} seenSet - Internal cycle detection set (automatically managed)
 * @returns {boolean} true if values are deeply equal, false otherwise
 */

/**
 * Symbol used to mark objects with a conceptual identity that transcends reference equality.
 *
 * When two different object instances share the same SYMBOL_IDENTITY value, they are
 * considered equal by compareTwoJsValues without performing expensive deep comparison.
 *
 * This enables recognition of "the same logical object" even when:
 * - The object has been copied via spread operator: `{ ...obj, newProp }`
 * - The object has been reconstructed from serialization
 * - The object is a different instance but represents the same conceptual entity
 *
 * Use Symbol.for() to ensure the same symbol across different modules/contexts.
 */
export const SYMBOL_IDENTITY = Symbol.for("navi_object_identity");

export const compareTwoJsValues = (rootA, rootB, { keyComparator } = {}) => {
  const seenSet = new Set();
  const compare = (a, b) => {
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
    const aIsPrimitive =
      a === null || (aType !== "object" && aType !== "function");
    const bIsPrimitive =
      b === null || (bType !== "object" && bType !== "function");
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
        const comparator = keyComparator || compare;
        if (!comparator(aValue, bValue, i, compare)) {
          return false;
        }
        i++;
      }
      return true;
    }
    // compare objects
    const aIdentity = a[SYMBOL_IDENTITY];
    const bIdentity = b[SYMBOL_IDENTITY];
    if (
      aIdentity === bIdentity &&
      SYMBOL_IDENTITY in a &&
      SYMBOL_IDENTITY in b
    ) {
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
      const comparator = keyComparator || compare;
      if (!comparator(aValue, bValue, key, compare)) {
        return false;
      }
    }
    return true;
  };
  return compare(rootA, rootB);
};
