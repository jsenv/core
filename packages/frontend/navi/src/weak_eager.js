let debug = false;

const IDLE_TIMEOUT = 500;
const EAGER = true;

export const createIterableEagerWeakSet = (name) => {
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
      console.debug(
        `🧹 ${name}: cleaned up ${cleanedCount} dead references in that weak set`,
      );
    }
    // Only schedule next cleanup if there are still refs
    if (objectWeakRefSet.size > 0) {
      scheduleNextCleanup();
    }
    return { cleaned: cleanedCount, remaining: objectWeakRefSet.size };
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

  const finalizationRegistry = new FinalizationRegistry(() => {
    scheduleNextCleanup();
  });

  return {
    add: (object) => {
      const objectWeakRef = new WeakRef(object);
      objectWeakRefSet.add(objectWeakRef);
      finalizationRegistry.register(object);
      if (EAGER) {
        scheduleNextCleanup();
      }
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

export const createEagerWeakRef = (object, name = "weakRef") => {
  const weakRef = new WeakRef(object);

  let cleanupScheduled = false;
  let idleCallbackId = null;
  let isDead = false;

  const checkAndCleanup = () => {
    if (weakRef.deref() === undefined) {
      isDead = true;
      if (debug) {
        console.debug(`🧹 ${name}: WeakRef is now dead`);
      }
    }
  };

  const performCleanup = () => {
    cleanupScheduled = false;
    idleCallbackId = null;
    checkAndCleanup();

    // ✅ If still alive, schedule next check
    if (!isDead) {
      scheduleCleanup();
    }
  };

  const scheduleCleanup = () => {
    if (cleanupScheduled || isDead) {
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
          scheduleCleanup();
        }
      },
      { timeout: IDLE_TIMEOUT },
    );
  };

  const finalizationRegistry = new FinalizationRegistry(() => {
    scheduleCleanup();
  });

  finalizationRegistry.register(object);

  if (EAGER) {
    scheduleCleanup();
  }

  return {
    deref() {
      const obj = weakRef.deref();
      if (obj === undefined && !isDead) {
        isDead = true;
        if (debug) {
          console.debug(`🧹 ${name}: WeakRef became dead during deref()`);
        }
      }
      return obj;
    },

    isDead() {
      if (isDead) {
        return true;
      }
      checkAndCleanup();
      if (!isDead) {
        scheduleCleanup();
      }
      return isDead;
    },

    forceCleanup() {
      if (idleCallbackId !== null) {
        cancelIdleCallback(idleCallbackId);
        idleCallbackId = null;
      }
      cleanupScheduled = false;
      checkAndCleanup();
      return isDead;
    },

    schedule: scheduleCleanup,

    getStats() {
      return {
        name,
        isDead,
        cleanupScheduled,
        gcStrategy: "proactive cleanup via requestIdleCallback",
      };
    },
  };
};
