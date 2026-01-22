import { hookIntoMethod } from "../hook_into_method.js";
import { renderConsole } from "../render_side_effects.js";
import { groupLogSideEffects } from "./group_log_side_effects.js";

const logSideEffectsOptionsDefault = {
  prevent: false,
  group: true,
  level: "info", // "debug", "trace", "info", "warn", "error", "off"
  onlyIfLevel: "debug",
};

export const isLogSideEffect = (sideEffect) => {
  const { type } = sideEffect;
  return typeof typeToLevelMap[type] === "number";
};
const typeToLevelMap = {
  "console.debug": 0,
  "console.trace": 1,
  "console.info": 2,
  "console.log": 2,
  "process.stdout": 2,
  "console.warn": 3,
  "console.error": 4,
  "process.stderr": 4,
};
const levelNumberMap = {
  debug: 0,
  trace: 1,
  info: 2,
  warn: 3,
  error: 4,
  off: 5,
};

export const logSideEffects = (logSideEffectsOptions) => {
  logSideEffectsOptions = {
    ...logSideEffectsOptionsDefault,
    ...logSideEffectsOptions,
  };
  return {
    name: "console",
    install: (addSideEffect, { addFinallyCallback }) => {
      const { level, prevent, group, onlyIfLevel } = logSideEffectsOptions;
      const levelNumber = levelNumberMap[level];
      if (onlyIfLevel && onlyIfLevel !== "debug") {
        const onlyIfLevelNumber = levelNumberMap[onlyIfLevel];
        addFinallyCallback((sideEffects) => {
          const logSideEffects = [];
          let hasOneOfLevelOrAbove;
          for (const sideEffect of sideEffects) {
            if (!isLogSideEffect(sideEffect)) {
              continue;
            }
            logSideEffects.push(sideEffect);
            if (!hasOneOfLevelOrAbove) {
              const sideEffectLevel = typeToLevelMap[sideEffect.type];
              hasOneOfLevelOrAbove = sideEffectLevel >= onlyIfLevelNumber;
            }
          }
          if (!hasOneOfLevelOrAbove) {
            for (const logSideEffect of logSideEffects) {
              sideEffects.removeSideEffect(logSideEffect);
            }
          }
        });
      }
      if (group) {
        addFinallyCallback((sideEffects) => {
          groupLogSideEffects(sideEffects, {
            createLogGroupSideEffect: (logSideEffectArray) => {
              const logGroupSideEffect = {
                code: "log_group",
                type: `log_group`,
                value: {}, // TODO: the concatenation of the logs
                render: {
                  md: (options) => {
                    const renderLogGroup = () => {
                      let logs = "";
                      let i = 0;
                      while (i < logSideEffectArray.length) {
                        const logSideEffect = logSideEffectArray[i];
                        i++;
                        const { text } = logSideEffect.render.md(options);
                        logs += text.value;
                        if (
                          i !== logSideEffectArray.length &&
                          logSideEffect.type.startsWith("console")
                        ) {
                          logs += "\n";
                        }
                      }
                      const logGroupMd = renderConsole(logs, {
                        sideEffect: logGroupSideEffect,
                        ...options,
                      });
                      return logGroupMd;
                    };
                    return {
                      label: `logs`,
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
        const sideEffectLevel = typeToLevelMap[type];
        if (sideEffectLevel < levelNumber) {
          return;
        }
        message = String(message);
        // some messages are flaky by definition we don't want to
        // fail on thoose
        if (
          message.includes(
            "GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels",
          )
        ) {
          return;
        }
        if (message.includes("task queue exceeded allotted deadline by")) {
          return;
        }
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
