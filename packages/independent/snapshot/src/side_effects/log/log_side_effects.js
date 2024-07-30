import { hookIntoMethod } from "../hook_into_method.js";
import { renderConsole } from "../render_side_effects.js";
import { groupLogSideEffects } from "./group_log_side_effects.js";

const logSideEffectsOptionsDefault = {
  prevent: true,
  group: false,
};

export const logSideEffects = (logSideEffectsOptions) => {
  logSideEffectsOptions = {
    ...logSideEffectsOptionsDefault,
    ...logSideEffectsOptions,
  };
  return {
    name: "console",
    install: (addSideEffect, { addFinallyCallback }) => {
      const { prevent, group } = logSideEffectsOptions;
      if (group) {
        addFinallyCallback((sideEffects) => {
          groupLogSideEffects(sideEffects, {
            createLogGroupSideEffect: (logSideEffectArray) => {
              const logGroupSideEffect = {
                code: "log_group",
                type: `log_group`,
                value: {},
                render: {
                  md: (options) => {
                    const renderLogGroup = () => {
                      let logs = "";
                      for (const logSideEffect of logSideEffectArray) {
                        const { text } = logSideEffect.render.md(options);
                        logs += text.value;
                      }
                      const logGroupMd = renderConsole(logs, {
                        sideEffect: logGroupSideEffect,
                        ...options,
                      });
                      return logGroupMd;
                    };
                    return {
                      label: `terminal`,
                      text: renderLogGroup(),
                    };
                  },
                },
              };
              return logGroupSideEffect;
            },
          });
        });
      }
      const addLogSideEffect = (type, message) => {
        addSideEffect({
          code: type,
          type,
          value: message,
          render: {
            md: () => {
              return {
                label: type,
                text: {
                  type: "console",
                  value: message,
                },
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
