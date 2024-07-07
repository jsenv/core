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

  var namespace;
  return {
    setters: [],
    execute: async function () {
      return _await(_context.import("/js/data.json.nomodule.js?debug"), function (_context$import) {
        namespace = _context$import;
        window.resolveResultPromise(namespace.default);
      });
    }
  };
});