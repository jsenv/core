/**
 * Creates a simple publish/subscribe pair.
 *
 * @param {boolean} [clearOnPublish=false] - When true, all subscribers are removed after each publish call.
 * @returns {[publish: (...args: any[]) => any[], subscribe: (callback: Function) => () => void, clear: () => void]}
 *   - `publish(...args)` — calls all subscribers with the given arguments and returns their return values.
 *   - `subscribe(callback)` — registers a subscriber and returns an unsubscribe function.
 *   - `clear()` — removes all subscribers without calling them.
 */
export const createPubSub = (clearOnPublish = false) => {
  const callbackSet = new Set();

  const publish = (...args) => {
    const results = [];
    for (const callback of callbackSet) {
      const result = callback(...args);
      results.push(result);
    }
    if (clearOnPublish) {
      callbackSet.clear();
    }
    return results;
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
