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
System.register([__v__("/js/ping.nomodule.js")], function (_export, _context) {
  "use strict";

  var ping, testWorker, worker, workerResponse;
  return {
    setters: [function (_pingJs) {
      ping = _pingJs.ping;
    }],
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
        type: "module"
      });
      return _await(testWorker(worker), function (_testWorker) {
        workerResponse = _testWorker;
        window.resolveResultPromise({
          ping,
          workerResponse
        });
      });
    }
  };
});