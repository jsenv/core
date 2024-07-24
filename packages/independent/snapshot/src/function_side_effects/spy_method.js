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
    let currentArgs;
    let originalCalled = false;
    let originalReturnValue;
    let preventOriginalCallCalled;
    let spyExecuting;
    onOriginalCall = (returnValue) => {
      originalCalled = true;
      originalReturnValue = returnValue;
    };
    callOriginal = () => {
      onOriginalCall(original(...currentArgs));
      return originalReturnValue;
    };
    preventOriginalCall = () => {
      preventOriginalCallCalled = true;
    };
    const spyCallbackSet = new Set();
    const spy = (...args) => {
      currentArgs = args;
      originalCalled = false;
      if (spyExecuting) {
        // when a spy is executing
        // if it calls the method himself
        // then we want this call to go trough
        // and others spy should not know about it
        return callOriginal();
      }
      spyExecuting = true;
      for (const spyCallback of spyCallbackSet) {
        const originalCalledCache = originalCalled;
        originalCalled = false;
        try {
          spyCallback(...args);
        } finally {
          if (originalCalled) {
          }
          // original not called by the spy
          // should we call it ourselves
          else if (preventOriginalCallCalled) {
            originalCalled = originalCalledCache;
          } else {
            callOriginal();
          }
          preventOriginalCallCalled = false;
        }
      }
      spyExecuting = false;
      currentArgs = null;
      if (originalCalled) {
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
