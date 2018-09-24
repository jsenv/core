"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.guardAsync = exports.guard = undefined;

var _action = require("@dmail/action");

var guard = exports.guard = function guard(fn, shield) {
  return function () {
    var shieldAction = (0, _action.passed)(shield.apply(undefined, arguments));

    if (shieldAction.isPassed()) {
      return fn.apply(undefined, arguments);
    }
    if (shieldAction.isFailed()) {
      return undefined;
    }
    throw new Error("guard expect shield to pass/fail synchronously");
  };
};

var guardAsync = exports.guardAsync = function guardAsync(fn, shield) {
  return function () {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return (0, _action.passed)(shield.apply(undefined, args)).then(function () {
      return fn.apply(undefined, args);
    });
  };
};
//# sourceMappingURL=guard.js.map