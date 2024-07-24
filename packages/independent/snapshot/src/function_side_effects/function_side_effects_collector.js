import { createException } from "@jsenv/exception";
import { replaceFluctuatingValues } from "../replace_fluctuating_values.js";
import { wrapIntoMarkdownBlock } from "./function_side_effects_renderer.js";

const RETURN_PROMISE = {};

let functionExecutingCount = 0;

export const collectFunctionSideEffects = (
  fn,
  sideEffectDetectors,
  { rootDirectoryUrl },
) => {
  const sideEffects = [];
  const addSideEffect = (sideEffect) => {
    sideEffects.push(sideEffect);
  };
  const finallyCallbackSet = new Set();
  for (const sideEffectDetector of sideEffectDetectors) {
    const uninstall = sideEffectDetector.install(addSideEffect);
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
  functionExecutingCount++;

  const onCatch = (valueThrow) => {
    sideEffects.push({
      type: "throw",
      value: valueThrow,
      label: "throw",
      text: wrapIntoMarkdownBlock(
        renderValueThrownOrRejected(
          createException(valueThrow, { rootDirectoryUrl }),
          { rootDirectoryUrl },
        ),
      ),
    });
  };
  const onReturn = (valueReturned) => {
    if (valueReturned === RETURN_PROMISE) {
      sideEffects.push({
        type: "return",
        value: valueReturned,
        label: "return promise",
        text: null,
      });
    } else {
      sideEffects.push({
        type: "return",
        value: valueReturned,
        label: "return",
        text: wrapIntoMarkdownBlock(
          renderReturnValueOrResolveValue(valueReturned, {
            rootDirectoryUrl,
          }),
          "js",
        ),
      });
    }
  };
  const onResolve = (value) => {
    sideEffects.push({
      type: "resolve",
      value,
      label: "resolve",
      text: wrapIntoMarkdownBlock(
        renderReturnValueOrResolveValue(value, { rootDirectoryUrl }),
        "js",
      ),
    });
  };
  const onReject = (reason) => {
    sideEffects.push({
      type: "reject",
      value: reason,
      label: "reject",
      text: wrapIntoMarkdownBlock(
        renderValueThrownOrRejected(
          createException(reason, { rootDirectoryUrl }),
          { rootDirectoryUrl },
        ),
      ),
    });
  };
  const onFinally = () => {
    functionExecutingCount--;
    for (const finallyCallback of finallyCallbackSet) {
      finallyCallback();
    }
    finallyCallbackSet.clear();
  };

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

const renderReturnValueOrResolveValue = (value, { rootDirectoryUrl }) => {
  if (value === undefined) {
    return "undefined";
  }
  return replaceFluctuatingValues(JSON.stringify(value, null, "  "), {
    stringType: "json",
    rootDirectoryUrl,
  });
};

const renderValueThrownOrRejected = (value, { rootDirectoryUrl }) => {
  return replaceFluctuatingValues(
    value ? value.stack || value.message || value : String(value),
    {
      stringType: "error",
      rootDirectoryUrl,
    },
  );
};
