"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.enqueueCallByArgs = exports.enqueueCall = undefined;

var _action3 = require("@dmail/action");

var _memoize = require("../memoize.js");

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var createExecutionQueue = function createExecutionQueue() {
  var pendings = [];
  var running = false;

  var enqueue = function enqueue(fn) {
    for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }

    if (running) {
      var _action = (0, _action3.createAction)();
      pendings.push({ action: _action, fn: fn, args: args });
      return _action;
    }
    running = true;
    var action = (0, _action3.passed)(fn.apply(undefined, args));
    var onPassedOrFailed = function onPassedOrFailed() {
      running = false;
      if (pendings.length > 0) {
        var _pendings$shift = pendings.shift(),
            _action2 = _pendings$shift.action,
            _fn = _pendings$shift.fn,
            _args = _pendings$shift.args;

        _action2.pass(enqueue.apply(undefined, [_fn].concat(_toConsumableArray(_args))));
      }
    };
    action.then(onPassedOrFailed, onPassedOrFailed);
    return action;
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