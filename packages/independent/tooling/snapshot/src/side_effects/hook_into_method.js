const jsenvMethodProxySymbol = Symbol.for("jsenv_method_proxy");

export const hookIntoMethod = (
  object,
  method,
  initCallback,
  { execute = METHOD_EXECUTION_STANDARD } = {},
) => {
  const current = object[method];
  if (typeof current !== "function") {
    console.warn(`"${method}" is not a function on object, found ${current}`);
    return {
      disable: () => {},
      enable: () => {},
      remove: () => {},
    };
  }
  const jsenvSymbolValue = current[jsenvMethodProxySymbol];
  let addInitCallback;
  let removeInitCallback;
  if (jsenvSymbolValue) {
    addInitCallback = jsenvSymbolValue.addInitCallback;
    removeInitCallback = jsenvSymbolValue.removeInitCallback;
  } else {
    const original = current;
    let allWantsToPreventOriginalCall;
    let hookExecuting;
    const initCallbackSet = new Set();
    const callHooks = (hookCallbackSet, ...args) => {
      hookExecuting = true;
      for (const hookCallback of hookCallbackSet) {
        if (!hookCallback.initCallback.installed) {
          continue;
        }
        hookCallback(...args);
      }
      hookExecuting = false;
      hookCallbackSet.clear();
    };

    const proxy = function (...args) {
      if (hookExecuting) {
        // when a spy is executing
        // if it calls the method himself
        // then we want this call to go trough
        // and others spy should not know about it
        return original.call(this, ...args);
      }
      allWantsToPreventOriginalCall = undefined;
      const returnPromiseCallbackSet = new Set();
      const returnCallbackSet = new Set();
      const catchCallbackSet = new Set();
      const finallyCallbackSet = new Set();
      hookExecuting = true;
      for (const initCallback of initCallbackSet) {
        if (initCallback.disabled) {
          continue;
        }
        const hooks = initCallback(...args) || {};
        if (hooks.preventOriginalCall) {
          if (allWantsToPreventOriginalCall === undefined) {
            allWantsToPreventOriginalCall = true;
          }
        } else {
          allWantsToPreventOriginalCall = false;
        }
        if (hooks.returnPromise) {
          hooks.returnPromise.initCallback = initCallback;
          returnPromiseCallbackSet.add(hooks.returnPromise);
        }
        if (hooks.return) {
          hooks.return.initCallback = initCallback;
          returnCallbackSet.add(hooks.return);
        }
        if (hooks.catch) {
          hooks.catch.initCallback = initCallback;
          catchCallbackSet.add(hooks.catch);
        }
        if (hooks.finally) {
          hooks.finally.initCallback = initCallback;
          finallyCallbackSet.add(hooks.catch);
        }
      }
      hookExecuting = false;
      const onCatch = (valueThrown) => {
        returnCallbackSet.clear();
        callHooks(catchCallbackSet, valueThrown);
      };
      const onReturn = (...values) => {
        returnPromiseCallbackSet.clear();
        catchCallbackSet.clear();
        callHooks(returnCallbackSet, ...values);
      };
      const onReturnPromise = () => {
        callHooks(returnPromiseCallbackSet);
      };
      const onFinally = () => {
        callHooks(finallyCallbackSet);
      };
      if (allWantsToPreventOriginalCall) {
        onReturn(undefined);
        onFinally();
        return undefined;
      }
      return execute({
        original,
        thisValue: this,
        args,
        onCatch,
        onReturn,
        onReturnPromise,
        onFinally,
      });
    };
    addInitCallback = (initCallback) => {
      if (initCallbackSet.size === 0) {
        object[method] = proxy;
      }
      initCallbackSet.add(initCallback);
    };
    removeInitCallback = (initCallback) => {
      initCallbackSet.delete(initCallback);
      if (initCallbackSet.size === 0) {
        object[method] = original;
      }
    };
    proxy[jsenvMethodProxySymbol] = {
      addInitCallback,
      removeInitCallback,
      original,
    };
    object[method] = proxy;
  }
  initCallback.installed = true;
  addInitCallback(initCallback);
  const hook = {
    disable: () => {
      initCallback.disabled = true;
    },
    enable: () => {
      initCallback.disabled = false;
    },
    remove: () => {
      initCallback.installed = false;
      removeInitCallback(initCallback);
    },
  };
  return hook;
};
export const METHOD_EXECUTION_STANDARD = ({
  original,
  thisValue,
  args,
  onCatch,
  onFinally,
  onReturnPromise,
  onReturn,
}) => {
  let valueReturned;
  let thrown = false;
  let valueThrown;
  try {
    valueReturned = original.call(thisValue, ...args);
  } catch (e) {
    thrown = true;
    valueThrown = e;
  }
  if (thrown) {
    onCatch(valueThrown);
    onFinally();
    throw valueThrown;
  }
  if (valueReturned && typeof valueReturned.then === "function") {
    onReturnPromise();
    valueReturned.then(
      (valueResolved) => {
        onReturn(valueResolved);
        onFinally();
      },
      (valueRejected) => {
        onCatch(valueRejected);
        onFinally();
      },
    );
    return valueReturned;
  }
  onReturn(valueReturned);
  onFinally();
  return valueReturned;
};
export const METHOD_EXECUTION_NODE_CALLBACK = ({
  original,
  thisValue,
  args,
  onCatch,
  onFinally,
  onReturnPromise,
  onReturn,
}) => {
  const lastArgIndex = args.length - 1;
  const lastArg = args[lastArgIndex];
  const installProxyAndCall = (originalCallback, installCallbackProxy) => {
    const callbackProxy = function (...callbackArgs) {
      uninstallCallbackProxy();
      const [error, ...remainingArgs] = callbackArgs;
      if (error) {
        onCatch(error);
        originalCallback.call(this, ...callbackArgs);
        onFinally();
        return;
      }
      onReturn(...remainingArgs);
      originalCallback.call(this, ...callbackArgs);
      onFinally();
    };
    const uninstallCallbackProxy = installCallbackProxy(callbackProxy);
    try {
      return original.call(thisValue, ...args);
    } catch (e) {
      onCatch(e);
      onFinally();
      throw e;
    }
  };
  if (typeof lastArg === "function") {
    return installProxyAndCall(lastArg, (callbackProxy) => {
      args[lastArgIndex] = callbackProxy;
      return () => {
        // useless because are a copy of the args
        // so the mutation we do above ( args[lastArgIndex] =)
        // cannot be important for the method being proxied
        if (args[lastArgIndex] === callbackProxy) {
          args[lastArgIndex] = lastArg;
        }
      };
    });
  }
  if (lastArg && typeof lastArg === "object") {
    if (lastArg.context && typeof lastArg.context.callback === "function") {
      const originalCallback = lastArg.context.callback;
      return installProxyAndCall(originalCallback, (callbackProxy) => {
        lastArg.context.callback = callbackProxy;
        return () => {
          if (lastArg.context.callback === callbackProxy) {
            lastArg.context.callback = originalCallback;
          }
        };
      });
    }
    if (typeof lastArg.oncomplete === "function") {
      const originalCallback = lastArg.oncomplete;
      return installProxyAndCall(originalCallback, (callbackProxy) => {
        lastArg.oncomplete = callbackProxy;
        return () => {
          if (lastArg.oncomplete === callbackProxy) {
            lastArg.oncomplete = originalCallback;
          }
        };
      });
    }
  }
  return METHOD_EXECUTION_STANDARD({
    original,
    thisValue,
    args,
    onCatch,
    onFinally,
    onReturnPromise,
    onReturn,
  });
};

export const disableHooksWhileCalling = (fn, hookToDisableArray) => {
  for (const toDisable of hookToDisableArray) {
    toDisable.disable();
  }
  try {
    return fn();
  } finally {
    for (const toEnable of hookToDisableArray) {
      toEnable.enable();
    }
  }
};
