import { spyMethods } from "./spy_methods.js";

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
  const unspy = spyMethods(console, spies, {
    preventCallToOriginal: preventConsoleSideEffects,
  });
  restoreCallbackSet.add(() => {
    unspy();
  });
  return {
    restore: () => {
      for (const restoreCallback of restoreCallbackSet) {
        restoreCallback();
      }
      restoreCallbackSet.clear();
    },
  };
};
