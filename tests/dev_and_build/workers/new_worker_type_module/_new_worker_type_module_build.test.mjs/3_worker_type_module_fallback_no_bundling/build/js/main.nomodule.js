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

  var testWorker, worker, workerResponse, worker2, worker2Response;
  return {
    setters: [],
    execute: async function () {
      testWorker = async worker => {
        return new Promise((resolve, reject) => {
          worker.onmessage = e => {
            resolve(e.data);
          };
          worker.onerror = e => {
            reject(e.message);
          };
          worker.postMessage("ping");
        });
      };
      worker = new Worker("/worker.nomodule.js", {
        type: "classic"
      });
      return _await(testWorker(worker), function (_testWorker) {
        workerResponse = _testWorker;
        worker2 = new Worker(new URL("/worker.nomodule.js", _context.meta.url), {
          type: "classic"
        });
        return _await(testWorker(worker2), function (_testWorker2) {
          worker2Response = _testWorker2;
          window.resolveResultPromise({
            workerResponse,
            worker2Response
          });
        });
      });
    }
  };
});