let debug = false;

export const createWeakRegistry = (name) => {
  let cleanupScheduled = false;
  let cleanupTimeoutId = null;

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
    const cleanedCount = cleanup();
    if (debug && cleanedCount > 0) {
      console.debug(`🧹 ${name}: cleaned up ${cleanedCount} dead references`);
    }
    // Schedule next cleanup if there are still items to potentially clean
    scheduleNextCleanup();
  };

  const scheduleNextCleanup = () => {
    if (cleanupScheduled) return;

    cleanupScheduled = true;
    requestIdleCallback(
      (deadline) => {
        if (deadline.timeRemaining() > 0 || deadline.didTimeout) {
          performCleanup();
        } else {
          cleanupScheduled = false;
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
    schedule: scheduleNextCleanup,
    clear: () => {
      if (cleanupTimeoutId) {
        clearTimeout(cleanupTimeoutId);
        cleanupTimeoutId = null;
      }
      cleanupScheduled = false;
      performCleanup();
    },
  };
};
