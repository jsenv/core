'use strict';

var nativeTypeOf = function nativeTypeOf(obj) {
  return typeof obj;
};

var customTypeOf = function customTypeOf(obj) {
  return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
};

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? nativeTypeOf : customTypeOf;

// https://mathiasbynens.be/notes/globalthis

/* global globalThis */
var globalObject;

if ((typeof globalThis === "undefined" ? "undefined" : _typeof(globalThis)) === "object") {
  globalObject = globalThis;
} else {
  if (undefined) {
    globalObject = undefined;
  } else {
    // eslint-disable-next-line no-extend-native
    Object.defineProperty(Object.prototype, "__global__", {
      get: function get() {
        return this;
      },
      configurable: true
    }); // eslint-disable-next-line no-undef

    globalObject = __global__;
    delete Object.prototype.__global__;
  }

  globalObject.globalThis = globalObject;
}

var globalThis$1 = global.globalThis === global ? 42 : 40;

module.exports = globalThis$1;
//# sourceMappingURL=main.js.map
