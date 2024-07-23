export const spyConsoleCalls = ({ error, warn, info, log, trace }) => {
  const restoreCallbackSet = new Set();
  const spies = {
    error,
    warn,
    info,
    log,
    trace,
  };
  for (const method of Object.keys(spies)) {
    const spy = spies[method];
    if (!spy) {
      continue;
    }
    const original = console[method];
    if (typeof original !== "function") {
      continue;
    }
    restoreCallbackSet.add(() => {
      console[method] = original;
    });
    console[method] = (...args) => {
      return spy({
        callOriginal: () => original(...args),
        args,
      });
    };
  }
  return {
    restore: () => {
      for (const restoreCallback of restoreCallbackSet) {
        restoreCallback();
      }
      restoreCallbackSet.clear();
    },
  };
};
