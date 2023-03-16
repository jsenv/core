
self.resourcesFromJsenvBuild = {
  "/main.html": {
    "version": "f78edba7"
  },
  "/css/style.css": {
    "version": "0e312da1",
    "versionedUrl": "/css/style.css?v=0e312da1"
  },
  "/js/a.js": {
    "version": "766d14d0",
    "versionedUrl": "/js/a.js?v=766d14d0"
  },
  "/js/b.js": {
    "version": "2cc2d9e4",
    "versionedUrl": "/js/b.js?v=2cc2d9e4"
  }
};

;(function() {
  var __versionMappings__ = {
  "/js/a.js": "/js/a.js?v=766d14d0",
  "/js/b.js": "/js/b.js?v=2cc2d9e4"
};
  self.__v__ = function (specifier) {
    return __versionMappings__[specifier] || specifier
  };
})();
/* globals importScripts */

self.order = [];
self.order.push("before-a");
importScripts(__v__("/js/a.js"));
self.order.push("after-a");
self.addEventListener("message", async messageEvent => {
  if (messageEvent.data === "inspect") {
    messageEvent.ports[0].postMessage({
      order: self.order,
      resourcesFromJsenvBuild: self.resourcesFromJsenvBuild
    });
  }
});

// trigger jsenv dynamic import for slicedToArray
const fn = ([a]) => {
  console.log(a);
};
fn(["a"]);