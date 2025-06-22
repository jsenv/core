/**
 * Creates a WeakMap-like structure that supports both objects and primitives as keys,
 * with proper garbage collection and value-based comparison for objects.
 *
 * Standard WeakMap limitations this solves:
 * - WeakMaps only accept objects as keys (no primitives)
 * - WeakMaps are not iterable (can't search by value comparison)
 * - WeakMaps only match by reference equality (not deep equality)
 *
 * This implementation:
 * - Supports primitives AND objects as keys
 * - Allows finding objects by deep value comparison using compareTwoJsValues
 * - Maintains proper garbage collection for both keys and values
 * - Auto-cleans dead WeakRef entries via FinalizationRegistry
 *
 * Use cases:
 * - Memoization with object parameters that should match by content
 * - Caching where you want { id: 1 } and { id: 1 } to be treated as same key
 * - Any scenario needing WeakMap benefits but with primitive key support
 */
import { compareTwoJsValues } from "./compare_two_js_values.js";

export const createJsValueWeakMap = () => {
  // Direct reference cache for objects (standard WeakMap behavior)
  const objectDirectCache = new WeakMap(); // object -> value

  // Value comparison cache for objects (searches by deep equality)
  const objectComparisonCache = new Map(); // WeakRef<object> -> WeakRef<value>

  // Primitive keys cache (WeakMap doesn't support primitives)
  const primitiveCache = new Map(); // primitive -> WeakRef<value>

  // Auto-cleanup for primitive entries when values are garbage collected
  const primitiveCleanupRegistry = new FinalizationRegistry((primitiveKey) => {
    primitiveCache.delete(primitiveKey);
  });

  // Auto-cleanup for object comparison entries when keys OR values are garbage collected
  const objectCleanupRegistry = new FinalizationRegistry((objectKeyWeakRef) => {
    objectComparisonCache.delete(objectKeyWeakRef);
  });

  return {
    get(key) {
      const isObject = key && typeof key === "object";

      if (isObject) {
        // ✅ First try direct reference lookup (fastest)
        const directResult = objectDirectCache.get(key);
        if (directResult) {
          return directResult;
        }

        // ✅ Then try value-based comparison lookup
        for (const [keyWeakRef, valueWeakRef] of objectComparisonCache) {
          const cachedKey = keyWeakRef.deref();
          const cachedValue = valueWeakRef.deref();

          // Skip dead references (they'll be cleaned by FinalizationRegistry)
          if (!cachedKey || !cachedValue) {
            continue;
          }

          if (compareTwoJsValues(cachedKey, key)) {
            return cachedValue;
          }
        }
        return undefined;
      }

      // ✅ Handle primitive keys
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
        // ✅ Store in direct cache for reference-based lookup
        objectDirectCache.set(key, value);

        // ✅ Store in comparison cache for value-based lookup
        const keyWeakRef = new WeakRef(key);
        const valueWeakRef = new WeakRef(value);
        objectComparisonCache.set(keyWeakRef, valueWeakRef);

        // ✅ Register both key and value for automatic cleanup
        // When either key OR value is GC'd, remove the entry
        objectCleanupRegistry.register(key, keyWeakRef);
        objectCleanupRegistry.register(value, keyWeakRef);
      } else {
        // ✅ Store primitive key with weak value reference
        primitiveCache.set(key, new WeakRef(value));

        // ✅ Register value for automatic cleanup when GC'd
        primitiveCleanupRegistry.register(value, key);
      }
    },

    // ✅ Manual cleanup for testing or performance optimization
    cleanup() {
      // Clean dead entries from object comparison cache
      const deadObjectEntries = [];
      for (const [keyWeakRef, valueWeakRef] of objectComparisonCache) {
        if (!keyWeakRef.deref() || !valueWeakRef.deref()) {
          deadObjectEntries.push(keyWeakRef);
        }
      }
      deadObjectEntries.forEach((ref) => objectComparisonCache.delete(ref));

      // Clean dead entries from primitive cache
      const deadPrimitiveKeys = [];
      for (const [primitiveKey, valueWeakRef] of primitiveCache) {
        if (!valueWeakRef.deref()) {
          deadPrimitiveKeys.push(primitiveKey);
        }
      }
      deadPrimitiveKeys.forEach((key) => primitiveCache.delete(key));
    },

    // ✅ Debug information
    get stats() {
      return {
        objectDirectCacheSize: "unknown (WeakMap)",
        objectComparisonCacheSize: objectComparisonCache.size,
        primitiveCacheSize: primitiveCache.size,
        gcStrategy: "FinalizationRegistry + WeakRef",
      };
    },
  };
};
