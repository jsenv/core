/*
 * Deep structural equality for arbitrary JS values — what `===` can't do but this
 * codebase constantly needs: memoization cache keys ({ id: 1 } equal to { id: 1 }),
 * effect/memo dependency checks, signal/store change detection, and action
 * parameter deduplication.
 *
 * Beyond recursive object/array comparison it covers the edge cases `===` gets
 * "wrong" for equality purposes: NaN equals NaN, Date compared by time value,
 * cycles don't loop (a seen-set guards circular refs), and same-type is required
 * before descending. Cheap paths run first: reference equality, then the identity
 * short-circuit below, then array length before element-by-element.
 *
 * SYMBOL_IDENTITY. Two *different* object instances can be declared "conceptually
 * the same" by sharing a SYMBOL_IDENTITY value; the comparison then treats them as
 * equal with no deep walk. This is what lets a spread copy ({ ...params, extra })
 * still count as the same params as the original, and lets objects reconstructed
 * across a serialization boundary be recognized as one entity — the cases where a
 * content comparison would be too slow, or too strict to see them as equal. Use
 * Symbol.for() so the marker is the same symbol across modules/contexts:
 *
 *   const id = Symbol.for("params");
 *   a[SYMBOL_IDENTITY] = id;
 *   b[SYMBOL_IDENTITY] = id;
 *   compareTwoJsValues(a, b); // true immediately, no property walk
 */

// Marks objects with a conceptual identity that transcends reference equality —
// see the file comment. Symbol.for keeps it one shared symbol across modules.
export const SYMBOL_IDENTITY = Symbol.for("navi_object_identity");

/**
 * Deeply compares two values for structural equality.
 *
 * @param {any} rootA - First value.
 * @param {any} rootB - Second value.
 * @param {object} [options]
 * @param {(a: any, b: any, keyOrIndex: any, recurse: (a: any, b: any) => boolean) => boolean} [options.keyComparator]
 *   Custom comparator for object properties / array elements. Receives the internal
 *   `compare` as its last argument so it can defer to the default behavior.
 * @param {boolean} [options.ignoreArrayOrder=false] - Compare arrays as multisets:
 *   equal when they contain the same elements regardless of order.
 * @param {Iterable<string>} [options.lightKeySet] - Object keys to compare first —
 *   cheaper or likelier-to-differ ones — to short-circuit before the remaining keys.
 * @returns {boolean} true if the values are deeply equal.
 */
export const compareTwoJsValues = (
  rootA,
  rootB,
  { keyComparator, ignoreArrayOrder = false, lightKeySet } = {},
) => {
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
      if (ignoreArrayOrder) {
        // Unordered array comparison: each element in 'a' must have a match in 'b'
        const usedIndices = new Set();
        for (let i = 0; i < a.length; i++) {
          const aValue = a[i];
          let foundMatch = false;

          for (let j = 0; j < b.length; j++) {
            if (usedIndices.has(j)) {
              continue; // Already matched with another element
            }
            const bValue = b[j];
            if (compareAt(aValue, bValue, i)) {
              foundMatch = true;
              usedIndices.add(j);
              break;
            }
          }
          if (!foundMatch) {
            return false;
          }
        }
        return true;
      }
      // Ordered array comparison (original behavior)
      let i = 0;
      while (i < a.length) {
        const aValue = a[i];
        const bValue = b[i];
        if (!compareAt(aValue, bValue, i)) {
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
    // Date objects must be compared by time value, not by enumerable keys (which are empty)
    date_compare: {
      const aIsDate = a instanceof Date;
      const bIsDate = b instanceof Date;
      if (aIsDate !== bIsDate) {
        return false;
      }
      if (aIsDate && bIsDate) {
        const aTime = a.getTime();
        const bTime = b.getTime();
        if (aTime !== bTime) {
          return false;
        }
      }
    }
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) {
      return false;
    }
    if (lightKeySet) {
      // compare light keys first, then remaining keys
      // (optimization for cases where some keys are more likely to differ and/or faster to compare)
      const keySet = new Set(aKeys);
      for (const lightKey of lightKeySet) {
        const aValue = a[lightKey];
        const bValue = b[lightKey];
        if (!compareAt(aValue, bValue, lightKey)) {
          return false;
        }
        keySet.delete(lightKey);
      }
      for (const key of keySet) {
        const aValue = a[key];
        const bValue = b[key];
        if (!compareAt(aValue, bValue, key)) {
          return false;
        }
      }
    } else {
      for (const key of aKeys) {
        const aValue = a[key];
        const bValue = b[key];
        if (!compareAt(aValue, bValue, key)) {
          return false;
        }
      }
    }
    return true;
  };
  const compareAt = keyComparator
    ? (a, b, keyOrArrayIndex) => keyComparator(a, b, keyOrArrayIndex, compare)
    : compare;

  return compare(rootA, rootB);
};
