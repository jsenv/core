export const createWeakCacheMap = () => {
  const objectCache = new WeakMap(); // Pour les objets
  const primitiveCache = new Map(); // primitive -> WeakRef<item>

  const cleanupDeadRefs = () => {
    const keysToDelete = [];
    for (const [primitive, weakRef] of primitiveCache) {
      if (!weakRef.deref()) {
        keysToDelete.push(primitive);
      }
    }
    for (const key of keysToDelete) {
      primitiveCache.delete(key);
    }
  };

  return {
    get(item) {
      const isObject = item && typeof item === "object";
      if (isObject) {
        return objectCache.get(item);
      }
      const weakRef = primitiveCache.get(item);
      if (weakRef) {
        const action = weakRef.deref();
        if (action) {
          return action;
        }
        primitiveCache.delete(item);
      }
      return undefined;
    },

    set(item, value) {
      const isObject = item && typeof item === "object";
      if (isObject) {
        objectCache.set(item, value);
      } else {
        primitiveCache.set(item, new WeakRef(value));

        // Nettoyage périodique pour éviter l'accumulation
        if (primitiveCache.size % 100 === 0) {
          cleanupDeadRefs();
        }
      }
    },
  };
};
