export const spyMethod = (
  object,
  methodName,
  spy,
  { preventCallToOriginal } = {},
) => {
  const original = object[methodName];
  if (typeof original !== "function") {
    return () => {};
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
  return () => {
    object[methodName] = original;
  };
};
