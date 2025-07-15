/**
 * jsenv/navi - createJsValueWeakMap
 *
 * Key/value cache with true ephemeron behavior and deep equality support.
 *
 * Features:
 * - Mutual retention: key keeps value alive, value keeps key alive
 * - Deep equality: different objects with same content are treated as identical keys
 * - Automatic GC: entries are eligible for collection when unreferenced
 * - Iteration support: can iterate over live entries for deep equality lookup
 *
 * Implementation:
 * - Dual WeakMap (key->value, value->key) provides ephemeron behavior
 * - WeakRef registry enables iteration without preventing GC
 * - Primitives stored in Map (permanent retention - avoid for keys)
 *
 * Use case: Action caching where params (key) and action (value) should have
 * synchronized lifetimes while allowing natural garbage collection.
 */

import { compareTwoJsValues } from "./compare_two_js_values.js";

export const createJsValueWeakMap = () => {
  // Core ephemeron maps for mutual retention
  const keyToValue = new WeakMap(); // key -> value
  const valueToKey = new WeakMap(); // value -> key

  // Registry for iteration/deep equality (holds WeakRefs)
  const keyRegistry = new Set(); // Set of WeakRef(key)

  // Primitive cache
  const primitiveCache = new Map();

  function cleanupKeyRegistry() {
    for (const keyRef of keyRegistry) {
      if (keyRef.deref() === undefined) {
        keyRegistry.delete(keyRef);
      }
    }
  }

  return {
    *[Symbol.iterator]() {
      cleanupKeyRegistry();
      for (const keyRef of keyRegistry) {
        const key = keyRef.deref();
        if (key && keyToValue.has(key)) {
          yield [key, keyToValue.get(key)];
        }
      }
      for (const [k, v] of primitiveCache) {
        yield [k, v];
      }
    },

    get(key) {
      const isObject = key && typeof key === "object";
      if (isObject) {
        // Fast path: exact key match
        if (keyToValue.has(key)) {
          return keyToValue.get(key);
        }

        // Slow path: deep equality search
        cleanupKeyRegistry();
        for (const keyRef of keyRegistry) {
          const existingKey = keyRef.deref();
          if (existingKey && compareTwoJsValues(existingKey, key)) {
            return keyToValue.get(existingKey);
          }
        }
        return undefined;
      }
      return primitiveCache.get(key);
    },

    set(key, value) {
      const isObject = key && typeof key === "object";
      if (isObject) {
        cleanupKeyRegistry();

        // Remove existing deep-equal key
        for (const keyRef of keyRegistry) {
          const existingKey = keyRef.deref();
          if (existingKey && compareTwoJsValues(existingKey, key)) {
            const existingValue = keyToValue.get(existingKey);
            keyToValue.delete(existingKey);
            valueToKey.delete(existingValue);
            keyRegistry.delete(keyRef);
            break;
          }
        }

        // Set ephemeron pair
        keyToValue.set(key, value);
        valueToKey.set(value, key);
        keyRegistry.add(new WeakRef(key));
      } else {
        primitiveCache.set(key, value);
      }
    },

    delete(key) {
      const isObject = key && typeof key === "object";
      if (isObject) {
        cleanupKeyRegistry();

        // Try exact match first
        if (keyToValue.has(key)) {
          const value = keyToValue.get(key);
          keyToValue.delete(key);
          valueToKey.delete(value);

          // Remove from registry
          for (const keyRef of keyRegistry) {
            if (keyRef.deref() === key) {
              keyRegistry.delete(keyRef);
              break;
            }
          }
          return true;
        }

        // Try deep equality
        for (const keyRef of keyRegistry) {
          const existingKey = keyRef.deref();
          if (existingKey && compareTwoJsValues(existingKey, key)) {
            const value = keyToValue.get(existingKey);
            keyToValue.delete(existingKey);
            valueToKey.delete(value);
            keyRegistry.delete(keyRef);
            return true;
          }
        }
        return false;
      }
      return primitiveCache.delete(key);
    },

    getStats: () => {
      cleanupKeyRegistry();
      const aliveKeys = Array.from(keyRegistry).filter((ref) =>
        ref.deref(),
      ).length;

      return {
        ephemeronPairs: {
          total: keyRegistry.size,
          alive: aliveKeys,
          note: "True ephemeron: key ↔ value mutual retention via dual WeakMap",
        },
        primitive: {
          total: primitiveCache.size,
          note: "Primitive keys never GC'd",
        },
      };
    },
  };
};
