'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

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

var ask = _async(function () {
  return Promise.resolve(42);
});

exports.ask = ask;
//# sourceMappingURL=main.js.map
