const jsenvSpySymbol = Symbol.for("jsenv_spy");

export const spyMethod = (object, method, spyCallback) => {
  const current = object[method];
  const jsenvSpySymbolValue = current[jsenvSpySymbol];
  let addCallback;
  let removeCallback;
  let callOriginal;
  let onOriginalCall;
  let preventOriginalCall;
  if (jsenvSpySymbolValue) {
    addCallback = jsenvSpySymbolValue.addCallback;
    removeCallback = jsenvSpySymbolValue.removeCallback;
    callOriginal = jsenvSpySymbolValue.callOriginal;
    onOriginalCall = jsenvSpySymbolValue.onOriginalCall;
    preventOriginalCall = jsenvSpySymbolValue.preventOriginalCall;
  } else {
    const original = current;
    let currentThis;
    let currentArgs;
    let originalCalled = false;
    let originalReturnValue;
    let preventOriginalCallCalled;
    let spyExecuting;
    let someSpyUsedCallOriginal;
    let allSpyUsedPreventOriginalCall;
    onOriginalCall = (returnValue) => {
      originalCalled = true;
      originalReturnValue = returnValue;
    };
    callOriginal = () => {
      if (someSpyUsedCallOriginal) {
        return originalReturnValue;
      }
      someSpyUsedCallOriginal = true;
      onOriginalCall(original.call(currentThis, ...currentArgs));
      return originalReturnValue;
    };
    preventOriginalCall = () => {
      preventOriginalCallCalled = true;
    };
    const spyCallbackSet = new Set();
    const spy = function (...args) {
      if (spyExecuting) {
        // when a spy is executing
        // if it calls the method himself
        // then we want this call to go trough
        // and others spy should not know about it
        onOriginalCall(original.call(this, ...args));
        return originalReturnValue;
      }
      spyExecuting = true;
      originalCalled = false;
      currentThis = this;
      currentArgs = args;
      someSpyUsedCallOriginal = false;
      allSpyUsedPreventOriginalCall = true;
      for (const spyCallback of spyCallbackSet) {
        try {
          spyCallback(...args);
        } finally {
          if (preventOriginalCallCalled) {
            preventOriginalCallCalled = false;
          } else {
            allSpyUsedPreventOriginalCall = false;
          }
        }
      }
      spyExecuting = false;
      if (!someSpyUsedCallOriginal && !allSpyUsedPreventOriginalCall) {
        callOriginal();
      }
      currentThis = null;
      currentArgs = null;
      if (originalCalled) {
        originalCalled = false;
        const value = originalReturnValue;
        originalReturnValue = undefined;
        return value;
      }
      return undefined;
    };
    addCallback = (spyCallback) => {
      if (spyCallbackSet.size === 0) {
        object[method] = spy;
      }
      spyCallbackSet.add(spyCallback);
    };
    removeCallback = (spyCallback) => {
      spyCallbackSet.delete(spyCallback);
      if (spyCallbackSet.size === 0) {
        object[method] = original;
      }
    };
    spy[jsenvSpySymbol] = {
      addCallback,
      removeCallback,
      original,
      callOriginal,
      onOriginalCall,
      preventOriginalCall,
    };
    object[method] = spy;
  }
  addCallback(spyCallback);
  const spyHooks = {
    callOriginal,
    preventOriginalCall,
    remove: () => {
      removeCallback(spyCallback);
    },
  };
  return spyHooks;
};
