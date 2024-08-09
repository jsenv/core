import { parseFunction } from "@jsenv/assert/src/utils/function_parser.js";
import { ANSI, UNICODE } from "@jsenv/humanize";
import { createReplaceFilesystemWellKnownValues } from "../filesystem_well_known_values.js";
import { filesystemSideEffects } from "./filesystem/filesystem_side_effects.js";
import { logSideEffects } from "./log/log_side_effects.js";

export const createCaptureSideEffects = ({
  sourceFileUrl,
  logEffects = true,
  filesystemEffects = true,
  filesystemActions,
  executionEffects = {},
  rootDirectoryUrl,
  replaceFilesystemWellKnownValues = createReplaceFilesystemWellKnownValues({
    rootDirectoryUrl,
  }),
}) => {
  const detectors = [];
  if (logEffects) {
    detectors.push(logSideEffects(logEffects === true ? {} : logEffects));
  }
  let filesystemSideEffectsDetector;
  if (filesystemEffects) {
    filesystemSideEffectsDetector = filesystemSideEffects(
      filesystemEffects === true ? {} : filesystemEffects,
      {
        sourceFileUrl,
        replaceFilesystemWellKnownValues,
        filesystemActions,
      },
    );
    detectors.push(filesystemSideEffectsDetector);
  }

  const options = {
    rootDirectoryUrl,
    replaceFilesystemWellKnownValues,
  };
  let functionExecutingCount = 0;
  const capture = (fn, { callSite, baseDirectory } = {}) => {
    const unicodeSupported = UNICODE.supported;
    const ansiSupported = ANSI.supported;
    // this is fragile because if the copy of humanize we have
    // is not the same (different version)
    // we won't be able to force support
    // good enough for now
    UNICODE.supported = true;
    ANSI.supported = true;
    if (baseDirectory !== undefined && filesystemSideEffectsDetector) {
      filesystemSideEffectsDetector.setBaseDirectory(baseDirectory);
    }
    const startMs = Date.now();
    const sideEffects = [];
    sideEffects.options = options;
    const sideEffectTypeCounterMap = new Map();
    const onSideEffectAdded = (sideEffect) => {
      let counter = sideEffectTypeCounterMap.get(sideEffect.type) || 0;
      sideEffectTypeCounterMap.set(sideEffect.type, counter + 1);
      sideEffect.counter = counter;
      sideEffect.delay = Date.now() - startMs;
    };
    const onSideEffectRemoved = () => {};
    const addSideEffect = (sideEffect) => {
      sideEffects.push(sideEffect);
      onSideEffectAdded(sideEffect);
      return sideEffect;
    };
    const replaceSideEffect = (existingSideEffect, newSideEffect) => {
      const index = sideEffects.indexOf(existingSideEffect);
      sideEffects[index] = newSideEffect;
      onSideEffectRemoved(existingSideEffect);
      onSideEffectAdded(newSideEffect);
    };
    const removeSideEffect = (sideEffect) => {
      const index = sideEffects.indexOf(sideEffect);
      if (index > -1) {
        sideEffects.splice(index, 1);
        onSideEffectRemoved(sideEffect);
      }
    };
    sideEffects.replaceSideEffect = replaceSideEffect;
    sideEffects.removeSideEffect = removeSideEffect;

    const sourceCode = parseFunction(fn).body;
    addSideEffect({
      code: "source_code",
      type: "source_code",
      value: { sourceCode, callSite },
      render: {
        md: () => {
          return {
            type: "source_code",
            text: {
              type: "source_code",
              value: { sourceCode, callSite },
            },
          };
        },
      },
    });

    const finallyCallbackSet = new Set();
    const addFinallyCallback = (finallyCallback) => {
      finallyCallbackSet.add(finallyCallback);
    };
    const skippableHandlerSet = new Set();
    const addSkippableHandler = (skippableHandler) => {
      skippableHandlerSet.add(skippableHandler);
    };
    addFinallyCallback((sideEffects) => {
      let i = 0;
      while (i < sideEffects.length) {
        const sideEffect = sideEffects[i];
        i++;
        let skippableHandlerResult;
        for (const skippableHandler of skippableHandlerSet) {
          skippableHandlerResult = skippableHandler(sideEffect);
          if (skippableHandlerResult) {
            // there is no skippable per sideEffect type today
            // so even if the skippable doe not skip in the end
            // we don't have to check if an other skippable handler could
            break;
          }
        }
        if (skippableHandlerResult) {
          let j = i;
          while (j < sideEffects.length) {
            const afterSideEffect = sideEffects[j];
            j++;
            let stopCalled = false;
            let skipCalled = false;
            const stop = () => {
              stopCalled = true;
            };
            const skip = () => {
              skipCalled = true;
            };
            skippableHandlerResult(afterSideEffect, { skip, stop });
            if (skipCalled) {
              sideEffect.skippable = true;
              break;
            }
            if (stopCalled) {
              break;
            }
          }
        }
      }
    });
    addSkippableHandler((sideEffect) => {
      if (sideEffect.type === "return" && sideEffect.value === RETURN_PROMISE) {
        return (nextSideEffect, { skip }) => {
          if (
            nextSideEffect.code === "resolve" ||
            nextSideEffect.code === "reject"
          ) {
            skip();
          }
        };
      }
      return null;
    });

    for (const detector of detectors) {
      const uninstall = detector.install(addSideEffect, {
        addSkippableHandler,
        addFinallyCallback,
      });
      finallyCallbackSet.add(() => {
        uninstall();
      });
    }
    if (functionExecutingCount) {
      // The reason for this warning:
      // 1. fs side effect detectors is not yet fully compatible with that because
      //    callback.oncomplete redefinition might be wrong for open, mkdir etc
      //    (at least this is to be tested)
      // 2. It's usually a sign code forgets to put await in front of
      //    collectFunctionSideEffects or snapshotFunctionSideEffects
      // 3. collectFunctionSideEffects is meant to collect a function side effect
      //    during unit test. So in unit test the function being tested should be analyized
      //    and should not in turn analyze an other one
      console.warn(
        `captureSideEffects called while other function(s) side effects are collected`,
      );
    }

    const onCatch = (valueThrow) => {
      addSideEffect({
        code: "throw",
        type: "throw",
        value: valueThrow,
        render: {
          md: () => {
            return {
              label: "throw",
              text: {
                type: "js_value",
                value: valueThrow,
              },
            };
          },
        },
      });
    };
    const onReturn = (valueReturned) => {
      if (valueReturned === RETURN_PROMISE) {
        addSideEffect({
          code: "return",
          type: "return",
          value: valueReturned,
          render: {
            md: () => {
              return {
                label: "return promise",
              };
            },
          },
        });
        return;
      }
      addSideEffect({
        code: "return",
        type: "return",
        value: valueReturned,
        render: {
          md: () => {
            return {
              label: "return",
              text: {
                type: "js_value",
                value: valueReturned,
              },
            };
          },
        },
      });
    };
    const onResolve = (value) => {
      addSideEffect({
        code: "resolve",
        type: "resolve",
        value,
        render: {
          md: () => {
            return {
              label: "resolve",
              text: {
                type: "js_value",
                value,
              },
            };
          },
        },
      });
    };
    const onReject = (reason) => {
      addSideEffect({
        code: "reject",
        type: "reject",
        value: reason,
        render: {
          md: () => {
            return {
              label: "reject",
              text: {
                type: "js_value",
                value: reason,
              },
            };
          },
        },
      });
    };
    const onFinally = () => {
      delete process.env.CAPTURING_SIDE_EFFECTS;
      UNICODE.supported = unicodeSupported;
      ANSI.supported = ansiSupported;
      functionExecutingCount--;
      for (const finallyCallback of finallyCallbackSet) {
        finallyCallback(sideEffects);
      }
      finallyCallbackSet.clear();
    };

    process.env.CAPTURING_SIDE_EFFECTS = "1";
    functionExecutingCount++;
    let returnedPromise = false;
    try {
      const valueReturned = fn();
      if (valueReturned && typeof valueReturned.then === "function") {
        onReturn(RETURN_PROMISE);
        returnedPromise = valueReturned.then(
          (value) => {
            onResolve(value);
            onFinally();
            return sideEffects;
          },
          (e) => {
            if (executionEffects.catch === false) {
              throw e;
            }
            if (typeof executionEffects.catch === "function") {
              executionEffects.catch(e);
            }
            onReject(e);
            onFinally();
            return sideEffects;
          },
        );
        return returnedPromise;
      }
      onReturn(valueReturned);
      return sideEffects;
    } catch (e) {
      if (executionEffects.catch === false) {
        throw e;
      }
      if (typeof executionEffects.catch === "function") {
        executionEffects.catch(e);
      }
      onCatch(e);
      return sideEffects;
    } finally {
      if (!returnedPromise) {
        onFinally();
      }
    }
  };
  return capture;
};

const RETURN_PROMISE = {};
