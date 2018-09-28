"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.guard = exports.guardAsync = void 0;

var guardAsync = function guardAsync(fn, shield) {
  return function () {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return Promise.resolve().then(function () {
      return shield.apply(void 0, args);
    }).then(function (shielded) {
      return shielded ? undefined : fn.apply(void 0, args);
    });
  };
};

exports.guardAsync = guardAsync;
var guard = guardAsync;
exports.guard = guard;
//# sourceMappingURL=guard.js.map