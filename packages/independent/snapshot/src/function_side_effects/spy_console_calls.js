import { hookIntoMethod } from "./hook_into_method.js";

export const spyConsoleCalls = (
  { error, warn, info, log, trace, stdout, stderr },
  { preventConsoleSideEffects },
) => {
  const restoreCallbackSet = new Set();
  const errorHook = hookIntoMethod(console, "error", (message) => {
    return {
      preventOriginalCall: preventConsoleSideEffects,
      return: () => {
        error(message);
      },
    };
  });
  const warnHook = hookIntoMethod(console, "warn", (message) => {
    return {
      preventOriginalCall: preventConsoleSideEffects,
      return: () => {
        warn(message);
      },
    };
  });
  const infoHook = hookIntoMethod(console, "info", (message) => {
    return {
      preventOriginalCall: preventConsoleSideEffects,
      return: () => {
        info(message);
      },
    };
  });
  const logHook = hookIntoMethod(console, "log", (message) => {
    return {
      preventOriginalCall: preventConsoleSideEffects,
      return: () => {
        log(message);
      },
    };
  });
  const traceHook = hookIntoMethod(console, "trace", (message) => {
    return {
      preventOriginalCall: preventConsoleSideEffects,
      return: () => {
        trace(message);
      },
    };
  });
  const processStdouthook = hookIntoMethod(
    process.stdout,
    "write",
    (message) => {
      return {
        preventOriginalCall: preventConsoleSideEffects,
        return: () => {
          stdout(message);
        },
      };
    },
  );
  const processStderrHhook = hookIntoMethod(
    process.stderr,
    "write",
    (message) => {
      return {
        preventOriginalCall: preventConsoleSideEffects,
        return: () => {
          stderr(message);
        },
      };
    },
  );
  restoreCallbackSet.add(() => {
    errorHook.remove();
    warnHook.remove();
    infoHook.remove();
    logHook.remove();
    traceHook.remove();
    processStdouthook.remove();
    processStderrHhook.remove();
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
