"use strict";

var _action = require("@dmail/action");

var _test = require("@dmail/test");

var _assert = require("assert");

var _assert2 = _interopRequireDefault(_assert);

var _enqueueCall = require("./enqueueCall.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var isPassed = function isPassed(action) {
  return action.getState() === "passed";
};

var isFailed = function isFailed(action) {
  return action.getState() === "failed";
};

(0, _test.test)(function () {
  var fn = function fn(value) {
    return value;
  };
  var action = (0, _action.createAction)();
  var returnedAction = (0, _enqueueCall.enqueueCall)(fn)(action);

  _assert2["default"].equal(isPassed(returnedAction), false);
  action.pass(1);
  _assert2["default"].equal(isPassed(returnedAction), true);
  _assert2["default"].equal(returnedAction.getResult(), 1);
});

(0, _test.test)(function () {
  var fn = function fn(value) {
    return value;
  };
  var action = (0, _action.createAction)();
  var returnedAction = (0, _enqueueCall.enqueueCall)(fn)(action);

  _assert2["default"].equal(isFailed(returnedAction), false);
  action.fail(1);
  _assert2["default"].equal(isFailed(returnedAction), true);
  _assert2["default"].equal(returnedAction.getResult(), 1);
});

// un appel attends la résolution de tout autre appel en cours
(0, _test.test)(function () {
  var debounced = (0, _enqueueCall.enqueueCall)(function (action, value) {
    return action.then(function () {
      return value;
    });
  });
  var firstAction = (0, _action.createAction)();
  var firstCallAction = debounced(firstAction, 1);
  var secondAction = (0, _action.createAction)();
  var secondCallAction = debounced(secondAction, 2);

  _assert2["default"].equal(isPassed(firstCallAction), false);
  _assert2["default"].equal(isPassed(secondCallAction), false);
  firstAction.pass();
  _assert2["default"].equal(isPassed(firstCallAction), true);
  _assert2["default"].equal(firstCallAction.getResult(), 1);
  _assert2["default"].equal(isPassed(secondCallAction), false);
  secondAction.pass();
  _assert2["default"].equal(isPassed(secondCallAction), true);
  _assert2["default"].equal(secondCallAction.getResult(), 2);
});

// un appel atttends la fin de la résolution de tout autre appel ayant les "même" arguments
(0, _test.test)(function () {
  var map = new Map();
  var restoreByArgs = function restoreByArgs(value) {
    return map.get(value);
  };
  var memoizeArgs = function memoizeArgs(fn, value) {
    return map.set(value, fn);
  };
  var fn = function fn(action, value) {
    return action.then(function () {
      return value;
    });
  };
  var debounced = (0, _enqueueCall.enqueueCallByArgs)({ fn: fn, restoreByArgs: restoreByArgs, memoizeArgs: memoizeArgs });

  var firstAction = (0, _action.createAction)();
  var secondAction = (0, _action.createAction)();

  var firstCallAction = debounced(firstAction, 1);
  var secondCallAction = debounced(secondAction, 2);
  var thirdCallAction = debounced(firstAction, 3);

  _assert2["default"].equal(isPassed(firstCallAction), false);
  _assert2["default"].equal(isPassed(secondCallAction), false);
  _assert2["default"].equal(isPassed(thirdCallAction), false);
  firstAction.pass();
  _assert2["default"].equal(isPassed(firstCallAction), true);
  _assert2["default"].equal(firstCallAction.getResult(), 1);
  _assert2["default"].equal(isPassed(secondCallAction), false);
  _assert2["default"].equal(isPassed(thirdCallAction), true);
  _assert2["default"].equal(thirdCallAction.getResult(), 3);
  secondAction.pass();
  _assert2["default"].equal(isPassed(secondCallAction), true);
  _assert2["default"].equal(secondCallAction.getResult(), 2);
});
//# sourceMappingURL=enqueueCall.test.js.map