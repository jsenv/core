import { parseFunction } from "@jsenv/assert/src/utils/function_parser.js";
import { createException } from "@jsenv/exception";
import { createReplaceFilesystemWellKnownValues } from "../filesystem_well_known_values.js";
import { replaceFluctuatingValues } from "../replace_fluctuating_values.js";
import { filesystemSideEffects } from "./filesystem/filesystem_side_effects.js";
import { logSideEffects } from "./log/log_side_effects.js";
import { wrapIntoMarkdownBlock } from "./render_side_effects.js";

export const createCaptureSideEffects = ({
  logEffects = true,
  filesystemEffects = true,
  sideEffectFileUrl,
  rootDirectoryUrl,
  replaceFilesystemWellKnownValues = createReplaceFilesystemWellKnownValues({
    rootDirectoryUrl,
  }),
} = {}) => {
  const detectors = [];
  if (logEffects) {
    detectors.push(logSideEffects(logEffects === true ? {} : logEffects));
  }
  if (filesystemEffects) {
    const filesystemSideEffectsDetector = filesystemSideEffects(
      filesystemEffects === true ? {} : filesystemEffects,
      {
        replaceFilesystemWellKnownValues,
        sideEffectFileUrl,
      },
    );
    detectors.push(filesystemSideEffectsDetector);
  }

  const options = {
    rootDirectoryUrl,
    replaceFilesystemWellKnownValues,
  };
  let functionExecutingCount = 0;
  const capture = (fn) => {
    const sideEffects = [];
    sideEffects.options = options;
    const addSideEffect = (sideEffect) => {
      sideEffects.push(sideEffect);
      return sideEffect;
    };

    const sourceCode = parseFunction(fn).body;
    addSideEffect({
      type: "source_code",
      value: sourceCode,
      render: {
        md: () => {
          return {
            text: wrapIntoMarkdownBlock(sourceCode, "js"),
          };
        },
      },
    });

    const finallyCallbackSet = new Set();
    const addFinallyCallback = (finallyCallback) => {
      finallyCallbackSet.add(finallyCallback);
    };
    for (const detector of detectors) {
      const uninstall = detector.install(addSideEffect, {
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
        `collectFunctionSideEffects called while other function(s) side effects are collected`,
      );
    }

    const onCatch = (valueThrow) => {
      sideEffects.push({
        type: "throw",
        value: valueThrow,
        render: {
          md: (options) => {
            return {
              label: "throw",
              text: wrapIntoMarkdownBlock(
                renderValueThrownOrRejected(
                  createException(valueThrow, {
                    rootDirectoryUrl: options.rootDirectoryUrl,
                  }),
                  options,
                ),
              ),
            };
          },
        },
      });
    };
    const onReturn = (valueReturned) => {
      if (valueReturned === RETURN_PROMISE) {
        sideEffects.push({
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
      } else {
        sideEffects.push({
          type: "return",
          value: valueReturned,
          render: {
            md: (options) => {
              return {
                label: "return",
                text: wrapIntoMarkdownBlock(
                  renderReturnValueOrResolveValue(valueReturned, options),
                  "js",
                ),
              };
            },
          },
        });
      }
    };
    const onResolve = (value) => {
      sideEffects.push({
        type: "resolve",
        value,
        render: {
          md: (options) => {
            return {
              label: "resolve",
              text: wrapIntoMarkdownBlock(
                renderReturnValueOrResolveValue(value, options),
                "js",
              ),
            };
          },
        },
      });
    };
    const onReject = (reason) => {
      sideEffects.push({
        type: "reject",
        value: reason,
        render: {
          md: (options) => {
            return {
              label: "reject",
              text: wrapIntoMarkdownBlock(
                renderValueThrownOrRejected(
                  createException(reason, {
                    rootDirectoryUrl: options.rootDirectoryUrl,
                  }),
                  options,
                ),
              ),
            };
          },
        },
      });
    };
    const onFinally = () => {
      delete process.env.SNAPSHOTING_FUNCTION_SIDE_EFFECTS;
      functionExecutingCount--;
      for (const finallyCallback of finallyCallbackSet) {
        finallyCallback(sideEffects);
      }
      finallyCallbackSet.clear();
    };

    process.env.SNAPSHOTING_FUNCTION_SIDE_EFFECTS = "1";
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

const renderReturnValueOrResolveValue = (value, options) => {
  if (value === undefined) {
    return "undefined";
  }
  return replaceFluctuatingValues(JSON.stringify(value, null, "  "), {
    stringType: "json",
    ...options,
  });
};

const renderValueThrownOrRejected = (value, options) => {
  return replaceFluctuatingValues(
    value ? value.stack || value.message || value : String(value),
    {
      stringType: "error",
      ...options,
    },
  );
};

const RETURN_PROMISE = {};
