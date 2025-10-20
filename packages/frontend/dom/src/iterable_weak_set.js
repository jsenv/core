export const createIterableWeakSet = () => {
  const objectWeakRefSet = new Set();

  return {
    add: (object) => {
      const objectWeakRef = new WeakRef(object);
      objectWeakRefSet.add(objectWeakRef);
    },

    delete: (object) => {
      for (const weakRef of objectWeakRefSet) {
        if (weakRef.deref() === object) {
          objectWeakRefSet.delete(weakRef);
          return true;
        }
      }
      return false;
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
      for (const weakRef of objectWeakRefSet) {
        const objectCandidate = weakRef.deref();
        if (objectCandidate === undefined) {
          objectWeakRefSet.delete(weakRef);
          continue;
        }
        if (objectCandidate === object) {
          return true;
        }
      }
      return false;
    },

    clear: () => {
      objectWeakRefSet.clear();
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
