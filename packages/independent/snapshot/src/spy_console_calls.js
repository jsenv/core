import { spyMethod } from "./spy_method.js";

export const spyConsoleCalls = (
  { error, warn, info, log, trace },
  { preventConsoleSideEffects },
) => {
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
    const unspy = spyMethod(console, method, spy, {
      preventCallToOriginal: preventConsoleSideEffects,
    });
    restoreCallbackSet.add(() => {
      unspy();
    });
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
