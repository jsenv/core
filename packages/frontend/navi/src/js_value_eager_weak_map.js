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

let debug = false;

const IDLE_TIMEOUT = 100;
export const createJsValueEagerWeakMap = (name = "jsValueWeakMap") => {
  // Direct reference cache for objects (standard WeakMap behavior)
  const objectDirectCache = new WeakMap(); // object -> value

  // This prevents parameter objects from keeping actions alive
  const objectComparisonCache = new Map(); // keyWeakRef -> valueWeakRef

  // Primitive keys cache (WeakMap doesn't support primitives)
  const primitiveCache = new Map(); // primitive -> WeakRef<value>

  let cleanupScheduled = false;
  let idleCallbackId = null;

  const cleanup = () => {
    let objectCleaned = 0;
    let primitiveCleaned = 0;

    // Clean dead entries from object comparison cache
    for (const [keyWeakRef, valueWeakRef] of objectComparisonCache) {
      const key = keyWeakRef.deref();
      const value = valueWeakRef.deref();

      // Remove if EITHER key OR value is dead
      if (!key || !value) {
        objectComparisonCache.delete(keyWeakRef);
        objectCleaned++;
      }
    }

    // Clean dead entries from primitive cache
    for (const [primitiveKey, valueWeakRef] of primitiveCache) {
      if (!valueWeakRef.deref()) {
        primitiveCache.delete(primitiveKey);
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
      { timeout: IDLE_TIMEOUT },
    );
  };

  // ✅ FinalizationRegistry for VALUES only (not keys!)
  // This ensures cleanup happens when values (actions) are GC'd
  const valueCleanupRegistry = new FinalizationRegistry((keyWeakRef) => {
    // Value was GC'd, remove its entry
    if (objectComparisonCache.has(keyWeakRef)) {
      objectComparisonCache.delete(keyWeakRef);
      if (debug) {
        console.debug(`🧹 ${name}: Value GC'd, removed cache entry`);
      }
    }
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
        // ✅ Store in direct cache for reference-based lookup
        objectDirectCache.set(key, value);

        // ✅ CRITICAL: Store BOTH key and value as WeakRef!
        const keyWeakRef = new WeakRef(key);
        const valueWeakRef = new WeakRef(value);
        objectComparisonCache.set(keyWeakRef, valueWeakRef);

        // ✅ Register ONLY the value for cleanup when it's GC'd
        // This way, if the action (value) is GC'd, we remove the cache entry
        // even if the parameter object (key) is still alive!
        valueCleanupRegistry.register(value);

        // Schedule cleanup
        scheduleNextCleanup();
      } else {
        // Store primitive key with weak value reference
        const valueWeakRef = new WeakRef(value);
        primitiveCache.set(key, valueWeakRef);

        // Register value for cleanup when GC'd
        valueCleanupRegistry.register(value);

        scheduleNextCleanup();
      }
    },

    // ✅ Enhanced force cleanup
    forceCleanup: () => {
      if (idleCallbackId !== null) {
        cancelIdleCallback(idleCallbackId);
        idleCallbackId = null;
      }
      cleanupScheduled = false;
      return performCleanup();
    },

    schedule: scheduleNextCleanup,

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
        cleanupScheduled,
      };
    },

    cleanup() {
      return this.forceCleanup();
    },

    get stats() {
      return this.getStats();
    },
  };
};
