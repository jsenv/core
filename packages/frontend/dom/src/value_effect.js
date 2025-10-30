export const createValueEffect = (value) => {
  const callbackSet = new Set();
  const valueCleanupSet = new Set();

  const cleanup = () => {
    for (const valueCleanup of valueCleanupSet) {
      valueCleanup();
    }
    valueCleanupSet.clear();
  };

  const updateValue = (newValue) => {
    if (newValue === value) {
      return;
    }
    cleanup();
    const oldValue = value;
    value = newValue;
    for (const callback of callbackSet) {
      const returnValue = callback(newValue, oldValue);
      if (typeof returnValue === "function") {
        valueCleanupSet.add(returnValue);
      }
    }
  };

  const addEffect = (callback) => {
    callbackSet.add(callback);
    return () => {
      callbackSet.delete(callback);
    };
  };

  return [updateValue, addEffect, cleanup];
};
