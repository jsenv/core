/**
 * Creates a WeakMap-like structure that supports both objects and primitives as keys,
 * with proper garbage collection and value-based comparison for objects.
 *
 * KEY IMPROVEMENT: Parameters (keys) cannot keep values alive!
 * - Uses WeakRef for both keys AND values in comparison cache
 * - Values can be GC'd even if parameter objects are still alive
 * - More aggressive cleanup to prevent memory leaks
 */
import { compareTwoJsValues } from "./compare_two_js_values.js";

export const createJsValueWeakMap = () => {
  // Direct reference cache for objects (standard WeakMap behavior)
  const objectDirectCache = new WeakMap(); // object -> value

  // This prevents parameter objects from keeping actions alive
  const objectComparisonCache = new Map(); // keyWeakRef -> valueWeakRef

  // Primitive keys cache (WeakMap doesn't support primitives)
  const primitiveCache = new Map(); // primitive -> WeakRef<value>

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

      // Handle primitive keys with immediate cleanup
      const valueWeakRef = primitiveCache.get(key);
      if (valueWeakRef) {
        const value = valueWeakRef.deref();
        if (value) {
          return value;
        }
        // Dead reference, clean it up immediately
        primitiveCache.delete(key);
      }
      return undefined;
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
        // Store primitive key with weak value reference
        const valueWeakRef = new WeakRef(value);
        primitiveCache.set(key, valueWeakRef);
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
      const valueWeakRef = primitiveCache.get(key);
      if (valueWeakRef) {
        primitiveCache.delete(key);
        return true;
      }
      return false;
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

      let primitiveAlive = 0;
      let primitiveDead = 0;
      for (const [, valueWeakRef] of primitiveCache) {
        if (valueWeakRef.deref()) {
          primitiveAlive++;
        } else {
          primitiveDead++;
        }
      }

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
          total: primitiveCache.size,
          alive: primitiveAlive,
          dead: primitiveDead,
        },
        gcStrategy: "value-driven cleanup (keys cannot keep values alive)",
      };
    },
  };
};
