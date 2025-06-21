export const createWeakCacheMap = () => {
  const objectCache = new WeakMap(); // Pour les objets
  const primitiveCache = new Map(); // primitive -> WeakRef<item>

  const cleanupRegistry = new FinalizationRegistry((primitive) => {
    primitiveCache.delete(primitive);
  });

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
        cleanupRegistry.register(value, item);
      }
    },
  };
};
