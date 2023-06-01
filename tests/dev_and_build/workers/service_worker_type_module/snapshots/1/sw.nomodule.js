
self.resourcesFromJsenvBuild = {
  "/main.html": {
    "version": "eb2cf1d0"
  },
  "/css/style.css": {
    "version": "0e312da1",
    "versionedUrl": "/css/style.css?v=0e312da1"
  }
};
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
    global.swNomodule = mod.exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function _await(value, then, direct) {
    if (direct) {
      return then ? then(value) : value;
    }
    if (!value || !value.then) {
      value = Promise.resolve(value);
    }
    return then ? value.then(then) : value;
  }
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
  self.order = [];
  self.addEventListener("message", _async(function (messageEvent) {
    if (messageEvent.data === "inspect") {
      messageEvent.ports[0].postMessage({
        order: self.order,
        resourcesFromJsenvBuild: self.resourcesFromJsenvBuild
      });
    }
    return _await();
  }));

  // trigger jsenv dynamic import for slicedToArray
  const fn = ([a]) => {
    console.log(a);
  };
  fn(["a"]);
});