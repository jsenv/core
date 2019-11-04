var __namespace__ = function () {
  'use strict';

  function _typeof(obj) {
    if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
      _typeof = function (obj) {
        return typeof obj;
      };
    } else {
      _typeof = function (obj) {
        return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
      };
    }

    return _typeof(obj);
  } // eslint-disable-next-line no-undef


  if ((typeof globalThis === "undefined" ? "undefined" : _typeof(globalThis)) !== "object") {
    var globalObject;

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

  var importMetaUrl = document.currentScript && document.currentScript.src || new URL('main.js', document.baseURI).href;
  return importMetaUrl;
}();
//# sourceMappingURL=./main.js.map