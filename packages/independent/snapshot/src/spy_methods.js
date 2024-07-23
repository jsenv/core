export const spyMethods = (object, spies, { preventCallToOriginal } = {}) => {
  const undoCallbackSet = new Set();
  for (const methodName of Object.keys(spies)) {
    const spy = spies[methodName];
    if (!spy) {
      continue;
    }
    const original = object[methodName];
    if (typeof original !== "function") {
      continue;
    }
    let spyExecuting = false;
    object[methodName] = (...args) => {
      if (spyExecuting) {
        return original(...args);
      }
      let called = false;
      let callReturnValue;
      spyExecuting = true;
      try {
        spy({
          callOriginal: () => {
            called = true;
            callReturnValue = original(...args);
          },
          args,
        });
      } finally {
        spyExecuting = false;
      }
      if (called) {
        return callReturnValue;
      }
      if (preventCallToOriginal) {
        return undefined;
      }
      return original(...args);
    };
    undoCallbackSet.add(() => {
      object[methodName] = original;
    });
  }
  return () => {
    for (const undoCallback of undoCallbackSet) {
      undoCallback();
    }
    undoCallbackSet.clear();
  };
};
