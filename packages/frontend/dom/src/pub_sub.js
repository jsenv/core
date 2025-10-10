export const createPubSub = () => {
  const callbackSet = new Set();

  const publish = (...args) => {
    for (const callback of callbackSet) {
      callback(...args);
    }
  };

  const subscribe = (callback) => {
    if (typeof callback !== "function") {
      throw new TypeError("callback must be a function");
    }
    callbackSet.add(callback);
    return () => {
      callbackSet.delete(callback);
    };
  };

  const clear = () => {
    callbackSet.clear();
  };

  return [publish, subscribe, clear];
};
