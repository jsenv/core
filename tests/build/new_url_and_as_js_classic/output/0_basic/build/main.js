;(function() {
  var __versionMappings__ = {
    "/foo/other/file.txt": "/foo/other/file.txt?v=ead31da8"
  };
  window.__v__ = function (specifier) {
    return __versionMappings__[specifier] || specifier
  };
})();

(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof exports !== "undefined") {
    factory();
  } else {
    var mod = {
      exports: {}
    };
    factory();
    global.main = mod.exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var _currentUrl = document.currentScript.src;
  window.resolveResultPromise(new URL(__v__("/foo/other/file.txt"), _currentUrl).href.replace(window.origin, "window.origin"));
});