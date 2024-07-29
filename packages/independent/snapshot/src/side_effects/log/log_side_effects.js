import { hookIntoMethod } from "../hook_into_method.js";
import { wrapIntoMarkdownBlock } from "../render_side_effects.js";

const logSideEffectsOptionsDefault = {
  prevent: true,
};

export const logSideEffects = (logSideEffectsOptions) => {
  logSideEffectsOptions = {
    ...logSideEffectsOptionsDefault,
    ...logSideEffectsOptions,
  };
  return {
    name: "console",
    install: (addSideEffect) => {
      const { prevent } = logSideEffectsOptions;
      const addLogSideEffect = (type, message) => {
        addSideEffect({
          type,
          value: message,
          render: {
            md: ({ replace }) => {
              return {
                label: type,
                text: wrapIntoMarkdownBlock(
                  replace(message, { stringType: "console" }),
                  "console",
                ),
              };
            },
          },
        });
      };

      const errorHook = hookIntoMethod(console, "error", (message) => {
        return {
          preventOriginalCall: prevent,
          return: () => {
            addLogSideEffect("console.error", message);
          },
        };
      });
      const warnHook = hookIntoMethod(console, "warn", (message) => {
        return {
          preventOriginalCall: prevent,
          return: () => {
            addLogSideEffect("console.warn", message);
          },
        };
      });
      const infoHook = hookIntoMethod(console, "info", (message) => {
        return {
          preventOriginalCall: prevent,
          return: () => {
            addLogSideEffect("console.info", message);
          },
        };
      });
      const logHook = hookIntoMethod(console, "log", (message) => {
        return {
          preventOriginalCall: prevent,
          return: () => {
            addLogSideEffect("console.log", message);
          },
        };
      });
      const traceHook = hookIntoMethod(console, "trace", (message) => {
        return {
          preventOriginalCall: prevent,
          return: () => {
            addLogSideEffect("console.trace", message);
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
              addLogSideEffect("process.stdout", message);
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
              addLogSideEffect("process.stderr", message);
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
