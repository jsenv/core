"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createLockRegistry = undefined;

var _promise2 = require("../promise.js");

var createLock = function createLock() {
  var unusedCallback = void 0;
  var onceUnused = function onceUnused(callback) {
    unusedCallback = callback;
  };

  var pendings = [];
  var busy = false;

  var chain = function chain(callback) {
    if (busy) {
      var _createPromiseAndHook = (0, _promise2.createPromiseAndHooks)(),
          _promise = _createPromiseAndHook.promise,
          resolve = _createPromiseAndHook.resolve,
          reject = _createPromiseAndHook.reject;

      pendings.push({ promise: _promise, resolve: resolve, reject: reject, callback: callback });
      return _promise;
    }

    busy = true;
    var promise = Promise.resolve().then(callback);

    var fullfilledOrRejected = function fullfilledOrRejected() {
      busy = false;
      if (pendings.length === 0) {
        if (unusedCallback) {
          unusedCallback();
          unusedCallback = undefined;
        }
      } else {
        var _pendings$shift = pendings.shift(),
            _resolve = _pendings$shift.resolve,
            _callback = _pendings$shift.callback;

        _resolve(chain(_callback));
      }
    };

    promise.then(fullfilledOrRejected, fullfilledOrRejected);

    return promise;
  };

  return { chain: chain, onceUnused: onceUnused };
};

var createLockRegistry = exports.createLockRegistry = function createLockRegistry() {
  var lockBindings = [];
  var lockForRessource = function lockForRessource(ressource) {
    var lockBinding = lockBindings.find(function (lockBinding) {
      return lockBinding.ressource === ressource;
    });
    if (lockBinding) {
      return lockBinding.lock;
    }

    var lock = createLock();
    lockBindings.push({
      lock: lock,
      ressource: ressource
    });
    // to avoid lockBindings to grow for ever
    // we remove them from the array as soon as the ressource is not used anymore
    lock.onceUnused(function () {
      var index = lockBindings.indexOf(lock);
      lockBindings.splice(index, 1);
    });

    return lock;
  };
  return { lockForRessource: lockForRessource };
};
//# sourceMappingURL=createLock.js.map