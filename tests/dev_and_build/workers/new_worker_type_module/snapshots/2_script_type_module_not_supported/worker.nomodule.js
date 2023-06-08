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
    global.workerNomodule = mod.exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const pingResponse = "pong";
  self.addEventListener("message", function (e) {
    if (e.data === "ping") {
      self.postMessage(pingResponse);
    }
  });
});