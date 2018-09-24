"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.enqueueCallByArgs = exports.enqueueCall = undefined;

var _memoize = require("../memoize.js");

var _promise2 = require("../promise.js");

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var createExecutionQueue = function createExecutionQueue() {
  var pendings = [];
  var running = false;

  var enqueue = function enqueue(fn) {
    for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }

    if (running) {
      var _createPromiseAndHook = (0, _promise2.createPromiseAndHooks)(),
          _promise = _createPromiseAndHook.promise,
          resolve = _createPromiseAndHook.resolve,
          reject = _createPromiseAndHook.reject;

      pendings.push({ promise: _promise, resolve: resolve, reject: reject, fn: fn, args: args });
      return _promise;
    }
    running = true;

    var onPassedOrFailed = function onPassedOrFailed() {
      running = false;
      if (pendings.length > 0) {
        var _pendings$shift = pendings.shift(),
            _resolve = _pendings$shift.resolve,
            _fn = _pendings$shift.fn,
            _args = _pendings$shift.args;

        _resolve(enqueue.apply(undefined, [_fn].concat(_toConsumableArray(_args))));
      }
    };

    var promise = Promise.resolve(fn.apply(undefined, args));

    promise.then(onPassedOrFailed, onPassedOrFailed);

    return promise;
  };

  return enqueue;
};

var enqueueCall = exports.enqueueCall = function enqueueCall(fn) {
  var enqueue = createExecutionQueue();
  return function () {
    for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      args[_key2] = arguments[_key2];
    }

    return enqueue.apply(undefined, [fn].concat(args));
  };
};

var enqueueCallByArgs = exports.enqueueCallByArgs = function enqueueCallByArgs(fn) {
  return (0, _memoize.memoizeSync)(createExecutionQueue, (0, _memoize.createStore)({
    transform: function transform(enqueue) {
      for (var _len3 = arguments.length, args = Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
        args[_key3 - 1] = arguments[_key3];
      }

      return enqueue.apply(undefined, [fn].concat(args));
    }
  }));
};
//# sourceMappingURL=enqueueCall.js.map