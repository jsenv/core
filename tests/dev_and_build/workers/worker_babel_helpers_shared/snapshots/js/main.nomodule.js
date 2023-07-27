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
System.register([__v__("/js/objectSpread2.nomodule.js")], function (_export, _context) {
  "use strict";

  var _objectSpread2, worker, workerResponse;
  return {
    setters: [function (_objectSpread2Js) {
      _objectSpread2 = _objectSpread2Js._objectSpread2;
    }],
    execute: async function () {
      // this is causing an import to babel helper for object spread
      console.log(_objectSpread2({}, {
        answer: 42
      }));
      // this would crash the worker if that code was shared and executed
      // in the worker context
      window.toto = true;

      // eslint-disable-next-line no-new
      worker = new Worker(new URL("/worker.nomodule.js", _context.meta.url), {
        type: "classic"
      });
      return _await(new Promise((resolve, reject) => {
        worker.onmessage = e => {
          resolve(e.data);
        };
        worker.onerror = e => {
          reject(e.message);
        };
        worker.postMessage("ping");
      }), function (_Promise) {
        workerResponse = _Promise;
        window.resolveResultPromise({
          workerResponse
        });
      });
    }
  };
});