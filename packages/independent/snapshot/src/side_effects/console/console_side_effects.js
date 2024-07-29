import { hookIntoMethod } from "../hook_into_method.js";

const consoleSideEffectsOptionsDefault = {
  prevent: true,
};

export const consoleSideEffects = (consoleSideEffectsOptions) => {
  consoleSideEffectsOptions = {
    ...consoleSideEffectsOptionsDefault,
    ...consoleSideEffectsOptions,
  };
  return {
    name: "console",
    install: (addSideEffect) => {
      const { prevent } = consoleSideEffectsOptions;
      const errorHook = hookIntoMethod(console, "error", (message) => {
        return {
          preventOriginalCall: prevent,
          return: () => {
            addSideEffect({
              type: `console:error`,
              value: message,
            });
          },
        };
      });
      const warnHook = hookIntoMethod(console, "warn", (message) => {
        return {
          preventOriginalCall: prevent,
          return: () => {
            addSideEffect({
              type: `console:warn`,
              value: message,
            });
          },
        };
      });
      const infoHook = hookIntoMethod(console, "info", (message) => {
        return {
          preventOriginalCall: prevent,
          return: () => {
            addSideEffect({
              type: `console:info`,
              value: message,
            });
          },
        };
      });
      const logHook = hookIntoMethod(console, "log", (message) => {
        return {
          preventOriginalCall: prevent,
          return: () => {
            addSideEffect({
              type: `console:log`,
              value: message,
            });
          },
        };
      });
      const traceHook = hookIntoMethod(console, "trace", (message) => {
        return {
          preventOriginalCall: prevent,
          return: () => {
            addSideEffect({
              type: `console:trace`,
              value: message,
            });
          },
        };
      });
      const processStdouthook = hookIntoMethod(
        process.stdout,
        "write",
        (message) => {
          return {
            preventOriginalCall: prevent,
            return: () => {
              addSideEffect({
                type: `process:stdout`,
                value: message,
              });
            },
          };
        },
      );
      const processStderrHhook = hookIntoMethod(
        process.stderr,
        "write",
        (message) => {
          return {
            preventOriginalCall: prevent,
            return: () => {
              addSideEffect({
                type: `process:stderr`,
                value: message,
              });
            },
          };
        },
      );
      return () => {
        errorHook.remove();
        warnHook.remove();
        infoHook.remove();
        logHook.remove();
        traceHook.remove();
        processStdouthook.remove();
        processStderrHhook.remove();
      };
    },
  };
};
