function _async(f) {
  return function () {
    for (var args = [], i = 0; i < arguments.length; i++) {
      args[i] = arguments[i];
    }
    try {
      return Promise.resolve(f.apply(this, args));
    } catch (e) {
      return Promise.reject(e);
    }
  };
}
function _await(value, then, direct) {
  if (direct) {
    return then ? then(value) : value;
  }
  if (!value || !value.then) {
    value = Promise.resolve(value);
  }
  return then ? value.then(then) : value;
}
System.register([], function (_export, _context) {
  "use strict";

  var importMetaResolveReturnValue, script, scriptLoadPromise;
  return {
    setters: [],
    execute: async function () {
      importMetaResolveReturnValue = _context.meta.resolve("/js/foo.js");
      script = document.createElement("script");
      script.src = importMetaResolveReturnValue;
      scriptLoadPromise = new Promise(resolve => {
        script.onload = () => {
          resolve();
        };
      });
      document.head.appendChild(script);
      return _await(scriptLoadPromise, function () {
        window.resolveResultPromise({
          importMetaResolveReturnValue,
          __TEST__: window.__TEST__
        });
      });
    }
  };
});