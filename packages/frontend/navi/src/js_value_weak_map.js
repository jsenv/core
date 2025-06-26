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
 * - Auto-cleans dead WeakRef entries via proactive cleanup using requestIdleCallback
 *
 * Use cases:
 * - Memoization with object parameters that should match by content
 * - Caching where you want { id: 1 } and { id: 1 } to be treated as same key
 * - Any scenario needing WeakMap benefits but with primitive key support
 */
import { compareTwoJsValues } from "./compare_two_js_values.js";

let debug = false;

export const createJsValueWeakMap = (name = "jsValueWeakMap") => {
  // Direct reference cache for objects (standard WeakMap behavior)
  const objectDirectCache = new WeakMap(); // object -> value

  // Value comparison cache for objects (searches by deep equality)
  const objectComparisonCache = new Map(); // WeakRef<object> -> WeakRef<value>

  // Primitive keys cache (WeakMap doesn't support primitives)
  const primitiveCache = new Map(); // primitive -> WeakRef<value>

  // ✅ Proactive cleanup scheduling (same pattern as weak_registry)
  let cleanupScheduled = false;
  let idleCallbackId = null;

  const cleanup = () => {
    let objectCleaned = 0;
    let primitiveCleaned = 0;

    // Clean dead entries from object comparison cache
    for (const [keyWeakRef, valueWeakRef] of objectComparisonCache) {
      if (!keyWeakRef.deref() || !valueWeakRef.deref()) {
        objectComparisonCache.delete(keyWeakRef);
        objectCleaned++;
      }
    }

    // Clean dead entries from primitive cache
    for (const [key, valueWeakRef] of primitiveCache) {
      if (!valueWeakRef.deref()) {
        primitiveCache.delete(key);
        primitiveCleaned++;
      }
    }

    return {
      objectCleaned,
      primitiveCleaned,
      total: objectCleaned + primitiveCleaned,
    };
  };

  const performCleanup = () => {
    cleanupScheduled = false;
    idleCallbackId = null;
    const cleanedStats = cleanup();

    if (debug && cleanedStats.total > 0) {
      console.debug(
        `🧹 ${name}: cleaned up ${cleanedStats.objectCleaned} object entries, ${cleanedStats.primitiveCleaned} primitive entries`,
      );
    }

    // Schedule next cleanup if there are still entries
    if (objectComparisonCache.size > 0 || primitiveCache.size > 0) {
      scheduleNextCleanup();
    }

    return cleanedStats;
  };

  const scheduleNextCleanup = () => {
    if (cleanupScheduled) {
      return;
    }
    cleanupScheduled = true;
    idleCallbackId = requestIdleCallback(
      (deadline) => {
        if (deadline.timeRemaining() > 0 || deadline.didTimeout) {
          performCleanup();
        } else {
          cleanupScheduled = false;
          idleCallbackId = null;
          scheduleNextCleanup();
        }
      },
      { timeout: 2000 },
    );
  };

  // ✅ FinalizationRegistry that schedules proactive cleanup
  const primitiveCleanupRegistry = new FinalizationRegistry(() => {
    scheduleNextCleanup();
  });
  const objectCleanupRegistry = new FinalizationRegistry(() => {
    scheduleNextCleanup();
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

        // ✅ Then try value-based comparison lookup with inline cleanup
        for (const [keyWeakRef, valueWeakRef] of objectComparisonCache) {
          const cachedKey = keyWeakRef.deref();
          const cachedValue = valueWeakRef.deref();

          // Clean up dead references immediately during search
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

      // ✅ Handle primitive keys with immediate cleanup
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
        objectCleanupRegistry.register(key, keyWeakRef);
        objectCleanupRegistry.register(value, keyWeakRef);

        // ✅ Schedule proactive cleanup
        scheduleNextCleanup();
      } else {
        // ✅ Store primitive key with weak value reference
        const valueWeakRef = new WeakRef(value);
        primitiveCache.set(key, valueWeakRef);

        // ✅ Register value for automatic cleanup when GC'd
        primitiveCleanupRegistry.register(value, key);

        // ✅ Schedule proactive cleanup
        scheduleNextCleanup();
      }
    },

    // ✅ Force cleanup method (same as weak_registry)
    forceCleanup: () => {
      // Cancel any pending idle callback
      if (idleCallbackId !== null) {
        cancelIdleCallback(idleCallbackId);
        idleCallbackId = null;
      }
      cleanupScheduled = false;
      return performCleanup();
    },

    // ✅ Schedule cleanup method
    schedule: scheduleNextCleanup,

    // ✅ Enhanced debug information
    getStats: () => {
      let objectAlive = 0;
      let objectDead = 0;
      for (const [keyWeakRef, valueWeakRef] of objectComparisonCache) {
        if (keyWeakRef.deref() && valueWeakRef.deref()) {
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
        },
        primitive: {
          total: primitiveCache.size,
          alive: primitiveAlive,
          dead: primitiveDead,
        },
        gcStrategy: "proactive cleanup via requestIdleCallback",
        cleanupScheduled,
      };
    },

    // ✅ Manual cleanup (for backwards compatibility)
    cleanup() {
      return this.forceCleanup();
    },

    get stats() {
      return this.getStats();
    },
  };
};
