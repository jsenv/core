self.resourcesFromJsenvBuild = {
  "/main.html": {
    "version": "28eef952"
  },
  "/css/style.css": {
    "version": "2e9d11a2",
    "versionedUrl": "/css/style.css?v=2e9d11a2"
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
    global.sw = mod.exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function () {
  "use strict";

  self.order = [];
  self.addEventListener("message", async messageEvent => {
    if (messageEvent.data === "inspect") {
      messageEvent.ports[0].postMessage({
        order: self.order,
        resourcesFromJsenvBuild: self.resourcesFromJsenvBuild
      });
    }
  });
  const fn = ([a]) => {
    console.log(a);
  };
  fn(["a"]);
});