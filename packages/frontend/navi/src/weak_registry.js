let debug = false;

export const createWeakRegistry = (name) => {
  let cleanupScheduled = false;
  let idleCallbackId = null;
  const objectWeakRefSet = new Set();

  const cleanup = () => {
    let cleanedCount = 0;
    for (const weakRef of objectWeakRefSet) {
      if (weakRef.deref() === undefined) {
        cleanedCount++;
        objectWeakRefSet.delete(weakRef);
      }
    }
    return cleanedCount;
  };

  const performCleanup = () => {
    cleanupScheduled = false;
    idleCallbackId = null; // ✅ Clear the callback ID
    const cleanedCount = cleanup();
    if (debug && cleanedCount > 0) {
      console.debug(`🧹 ${name}: cleaned up ${cleanedCount} dead references`);
    }
    // Only schedule next cleanup if there are still refs and we cleaned something
    if (objectWeakRefSet.size > 0) {
      scheduleNextCleanup();
    }
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

  const finalizationRegistry = new FinalizationRegistry(() => {
    scheduleNextCleanup();
  });

  return {
    add: (object) => {
      const objectWeakRef = new WeakRef(object);
      objectWeakRefSet.add(objectWeakRef);
      finalizationRegistry.register(object);
      scheduleNextCleanup();
    },

    delete: (object) => {
      for (const weakRef of objectWeakRefSet) {
        if (weakRef.deref() === object) {
          objectWeakRefSet.delete(weakRef);
          finalizationRegistry.unregister(object);
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
        if (weakRef.deref() === object) {
          return true;
        }
      }
      return false;
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

    schedule: scheduleNextCleanup,

    forceCleanup: () => {
      // ✅ Cancel any pending idle callback
      if (idleCallbackId !== null) {
        cancelIdleCallback(idleCallbackId);
        idleCallbackId = null;
      }
      cleanupScheduled = false;
      return performCleanup();
    },
  };
};
