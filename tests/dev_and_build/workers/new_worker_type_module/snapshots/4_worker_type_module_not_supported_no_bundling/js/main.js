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
const testWorker = _async(function (worker) {
  return new Promise((resolve, reject) => {
    worker.onmessage = e => {
      resolve(e.data);
    };
    worker.onerror = e => {
      reject(e.message);
    };
    worker.postMessage("ping");
  });
});
function _await(value, then, direct) {
  if (direct) {
    return then ? then(value) : value;
  }
  if (!value || !value.then) {
    value = Promise.resolve(value);
  }
  return then ? value.then(then) : value;
}
const worker = new Worker("/worker.nomodule.js", {
  type: "classic"
});
_await(testWorker(worker), function (workerResponse) {
  const worker2 = new Worker(new URL("/worker.nomodule.js", import.meta.url), {
    type: "classic"
  });
  return _await(testWorker(worker2), function (worker2Response) {
    window.resolveResultPromise({
      workerResponse,
      worker2Response
    });
  });
});