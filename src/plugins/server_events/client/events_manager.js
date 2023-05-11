export const createEventsManager = ({ effect = () => {} } = {}) => {
  const callbacksMap = new Map();
  let cleanup;
  const addCallbacks = (namedCallbacks) => {
    let callbacksMapSize = callbacksMap.size;
    Object.keys(namedCallbacks).forEach((eventName) => {
      const callback = namedCallbacks[eventName];
      const existingCallbacks = callbacksMap.get(eventName);
      let callbacks;
      if (existingCallbacks) {
        callbacks = existingCallbacks;
      } else {
        callbacks = [];
        callbacksMap.set(eventName, callbacks);
      }
      callbacks.push(callback);
    });
    if (effect && callbacksMapSize === 0 && callbacksMapSize.size > 0) {
      cleanup = effect();
    }

    let removed = false;
    return () => {
      if (removed) return;
      removed = true;
      callbacksMapSize = callbacksMap.size;
      Object.keys(namedCallbacks).forEach((eventName) => {
        const callback = namedCallbacks[eventName];
        const callbacks = callbacksMap.get(eventName);
        if (callbacks) {
          const index = callbacks.indexOf(callback);
          if (index > -1) {
            callbacks.splice(index, 1);
            if (callbacks.length === 0) {
              callbacksMap.delete(eventName);
            }
          }
        }
      });
      namedCallbacks = null; // allow garbage collect
      if (
        cleanup &&
        typeof cleanup === "function" &&
        callbacksMapSize > 0 &&
        callbacksMapSize.size === 0
      ) {
        cleanup();
        cleanup = null;
      }
    };
  };

  const triggerCallbacks = (event) => {
    const callbacks = callbacksMap.get(event.type);
    if (callbacks) {
      callbacks.forEach((callback) => {
        callback(event);
      });
    }
  };

  const destroy = () => {
    callbacksMap.clear();
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
  };

  return {
    addCallbacks,
    triggerCallbacks,
    destroy,
  };
};
