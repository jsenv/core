export const createEventEmitter = () => {
  const callbackSet = new Set();
  const on = (callback) => {
    callbackSet.add(callback);
    return () => {
      callbackSet.delete(callback);
    };
  };
  const off = (callback) => {
    callbackSet.delete(callback);
  };
  const emit = (...args) => {
    callbackSet.forEach((callback) => {
      callback(...args);
    });
  };
  return { on, off, emit };
};
