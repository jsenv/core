import { createException } from "@jsenv/exception";
import { replaceFluctuatingValues } from "../replace_fluctuating_values.js";

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
      text: renderValueThrownOrRejected(
        createException(valueThrow, { rootDirectoryUrl }),
        { rootDirectoryUrl },
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
        text: renderReturnValueOrResolveValue(valueReturned, {
          rootDirectoryUrl,
        }),
      });
    }
  };
  const onResolve = (value) => {
    sideEffects.push({
      type: "resolve",
      value,
      label: "resolve",
      text: renderReturnValueOrResolveValue(value, { rootDirectoryUrl }),
    });
  };
  const onReject = (reason) => {
    sideEffects.push({
      type: "reject",
      value: reason,
      label: "reject",
      text: renderValueThrownOrRejected(
        createException(reason, { rootDirectoryUrl }),
        { rootDirectoryUrl },
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
