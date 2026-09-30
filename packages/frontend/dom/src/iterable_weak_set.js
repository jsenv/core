export const createIterableWeakSet = () => {
  const objectWeakRefSet = new Set();
  // The one WeakRef of each member, so that adding a member twice keeps one
  // entry and deleting it once removes it. Weak on the object, and a WeakRef
  // holds nothing: this keeps nothing alive.
  let weakRefMap = new WeakMap();

  return {
    add: (object) => {
      if (weakRefMap.has(object)) {
        return;
      }
      const objectWeakRef = new WeakRef(object);
      objectWeakRefSet.add(objectWeakRef);
      weakRefMap.set(object, objectWeakRef);
    },

    delete: (object) => {
      const objectWeakRef = weakRefMap.get(object);
      if (!objectWeakRef) {
        return false;
      }
      weakRefMap.delete(object);
      return objectWeakRefSet.delete(objectWeakRef);
    },

    *[Symbol.iterator]() {
      for (const objectWeakRef of objectWeakRefSet) {
        const object = objectWeakRef.deref();
        if (object === undefined) {
          objectWeakRefSet.delete(objectWeakRef);
          continue;
        }
        yield object;
      }
    },

    has: (object) => {
      return weakRefMap.has(object);
    },

    clear: () => {
      objectWeakRefSet.clear();
      weakRefMap = new WeakMap();
    },

    get size() {
      return objectWeakRefSet.size;
    },

    getStats: () => {
      let alive = 0;
      let dead = 0;
      for (const weakRef of objectWeakRefSet) {
        if (weakRef.deref() !== undefined) {
          alive++;
        } else {
          dead++;
        }
      }
      return { total: objectWeakRefSet.size, alive, dead };
    },
  };
};
