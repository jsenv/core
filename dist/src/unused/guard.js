"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var guardAsync = exports.guardAsync = function guardAsync(fn, shield) {
  return function () {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return Promise.resolve().then(function () {
      return shield.apply(undefined, args);
    }).then(function (shielded) {
      return shielded ? undefined : fn.apply(undefined, args);
    });
  };
};

var guard = exports.guard = guardAsync;
//# sourceMappingURL=guard.js.map