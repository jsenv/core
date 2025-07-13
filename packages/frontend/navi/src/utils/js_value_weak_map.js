/**
 * Creates a WeakMap-like structure that supports both objects and primitives as keys,
 * with proper garbage collection for objects and permanent caching for primitives.
 *
 * IMPORTANT: Primitive keys will cause memory to grow indefinitely!
 * - Object keys: Proper weak references, can be garbage collected
 * - Primitive keys: Strong references, preserved forever to maintain action identity
 * - Use object keys when possible to avoid memory leaks
 */
import { compareTwoJsValues } from "./compare_two_js_values.js";

export const createJsValueWeakMap = () => {
  // Direct reference cache for objects (standard WeakMap behavior)
  const objectDirectCache = new WeakMap(); // object -> value

  // This prevents parameter objects from keeping actions alive
  const objectComparisonCache = new Map(); // keyWeakRef -> valueWeakRef

  // Primitive keys cache (strong references - memory will grow!)
  const primitiveCache = new Map(); // primitive -> value (NOT WeakRef!)

  return {
    get(key) {
      const isObject = key && typeof key === "object";

      if (isObject) {
        // ✅ First try direct reference lookup (fastest)
        const directResult = objectDirectCache.get(key);
        if (directResult) {
          return directResult;
        }

        // ✅ Then try value-based comparison lookup with aggressive cleanup

        for (const [keyWeakRef, valueWeakRef] of objectComparisonCache) {
          const cachedKey = keyWeakRef.deref();
          const cachedValue = valueWeakRef.deref();

          // ✅ Clean up dead references immediately during search
          if (!cachedKey || !cachedValue) {
            objectComparisonCache.delete(keyWeakRef);
            continue;
          }

          if (compareTwoJsValues(cachedKey, key)) {
            return cachedValue;
          }
        }

        return undefined;
      }

      // Handle primitive keys (no cleanup - permanent cache)
      return primitiveCache.get(key);
    },

    set(key, value) {
      const isObject = key && typeof key === "object";

      if (isObject) {
        // Store in direct cache for reference-based lookup
        objectDirectCache.set(key, value);

        // Store BOTH key and value as WeakRef
        const keyWeakRef = new WeakRef(key);
        const valueWeakRef = new WeakRef(value);
        objectComparisonCache.set(keyWeakRef, valueWeakRef);
      } else {
        // Store primitive key with strong reference (permanent cache)
        primitiveCache.set(key, value);
      }
    },

    delete(key) {
      const isObject = key && typeof key === "object";

      if (isObject) {
        // Remove from direct cache
        const hadValue = objectDirectCache.delete(key);

        // ✅ Remove from comparison cache and unregister
        for (const [keyWeakRef] of objectComparisonCache) {
          const cachedKey = keyWeakRef.deref();
          if (cachedKey === key) {
            objectComparisonCache.delete(keyWeakRef);
            break;
          }
        }

        return hadValue;
      }
      // Handle primitive deletion
      return primitiveCache.delete(key);
    },

    // ✅ Enhanced debug information
    getStats: () => {
      let objectAlive = 0;
      let objectDead = 0;
      let keysAlive = 0;
      let keysDead = 0;

      for (const [keyWeakRef, valueWeakRef] of objectComparisonCache) {
        const key = keyWeakRef.deref();
        const value = valueWeakRef.deref();

        if (key) keysAlive++;
        else keysDead++;

        if (key && value) {
          objectAlive++;
        } else {
          objectDead++;
        }
      }

      let primitiveEntries = primitiveCache.size;

      return {
        objectDirectCacheSize: "unknown (WeakMap)",
        objectComparison: {
          total: objectComparisonCache.size,
          alive: objectAlive,
          dead: objectDead,
          keysAlive,
          keysDead,
        },
        primitive: {
          total: primitiveEntries,
          note: "Primitive keys are never garbage collected - memory grows indefinitely!",
        },
        gcStrategy: "objects: weak references, primitives: permanent cache",
      };
    },
  };
};
