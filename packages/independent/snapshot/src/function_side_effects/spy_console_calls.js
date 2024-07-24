import { spyMethod } from "./spy_method.js";

export const spyConsoleCalls = (
  { error, warn, info, log, trace },
  { preventConsoleSideEffects },
) => {
  const restoreCallbackSet = new Set();
  const errorSpy = spyMethod(console, "error", (message) => {
    if (preventConsoleSideEffects) {
      errorSpy.preventOriginalCall();
    }
    error(message);
  });
  const warnSpy = spyMethod(console, "warn", (message) => {
    if (preventConsoleSideEffects) {
      warnSpy.preventOriginalCall();
    }
    warn(message);
  });
  const infoSpy = spyMethod(console, "info", (message) => {
    if (preventConsoleSideEffects) {
      infoSpy.preventOriginalCall();
    }
    info(message);
  });
  const logSpy = spyMethod(console, "log", (message) => {
    if (preventConsoleSideEffects) {
      logSpy.preventOriginalCall();
    }
    log(message);
  });
  const traceSpy = spyMethod(console, "trace", (message) => {
    if (preventConsoleSideEffects) {
      traceSpy.preventOriginalCall();
    }
    trace(message);
  });
  restoreCallbackSet.add(() => {
    errorSpy.remove();
    warnSpy.remove();
    infoSpy.remove();
    logSpy.remove();
    traceSpy.remove();
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
