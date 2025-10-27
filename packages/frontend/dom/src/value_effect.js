export const createValueEffect = (value) => {
  const callbackSet = new Set();
  const previousValueCleanupSet = new Set();

  const updateValue = (newValue) => {
    if (newValue === value) {
      return;
    }
    for (const cleanup of previousValueCleanupSet) {
      cleanup();
    }
    previousValueCleanupSet.clear();
    const oldValue = value;
    value = newValue;
    for (const callback of callbackSet) {
      const returnValue = callback(newValue, oldValue);
      if (typeof returnValue === "function") {
        previousValueCleanupSet.add(returnValue);
      }
    }
  };

  const addEffect = (callback) => {
    callbackSet.add(callback);
    return () => {
      callbackSet.delete(callback);
    };
  };

  return [updateValue, addEffect];
};
