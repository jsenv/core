export const createDelayedCallbackController = (ms, callback) => {
  let remainingMs = ms;
  let timeout;
  let startMs;
  const delayedCallbackController = {
    isWaiting: false,
    start: () => {
      if (remainingMs <= 0) {
        callback();
        return;
      }
      delayedCallbackController.isWaiting = true;
      startMs = Date.now();
      timeout = setTimeout(() => {
        remainingMs = 0;
        delayedCallbackController.isWaiting = false;
        callback();
      }, remainingMs);
    },
    pause: () => {
      if (timeout === undefined) {
        return;
      }
      const ellapsedMs = startMs - Date.now();
      startMs = undefined;
      remainingMs -= ellapsedMs;
      clearTimeout(timeout);
      timeout = undefined;
    },
    remove: () => {
      if (timeout !== undefined) {
        clearTimeout(timeout);
        timeout = undefined;
        startMs = undefined;
        remainingMs = undefined;
      }
    },
  };
  return delayedCallbackController;
};
