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

  var _console;
  var values = [0, 1];
  (_console = console).log.apply(_console, values);
  window.ask = function () {
    return 42;
  };
});
//# sourceMappingURL=main.js.map?as_js_classic%3Fas_js_classic
