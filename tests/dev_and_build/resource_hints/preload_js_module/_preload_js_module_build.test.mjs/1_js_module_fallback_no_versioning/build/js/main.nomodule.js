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

  return {
    setters: [],
    execute: async function () {
      console.log(globalThis);
      _context.import("/js/dep.nomodule.js");

      // Let browser time to log an eventual warning about preload link not used
      return _await(new Promise(resolve => {
        setTimeout(resolve, 3000);
      }), function () {
        window.resolveResultPromise(42);
      });
    }
  };
});