self.resourcesFromJsenvBuild = {
  "/main.html": {
    "version": "56f4059a"
  },
  "/css/style.css": {
    "version": "2e9d11a2",
    "versionedUrl": "/css/style.css?v=2e9d11a2"
  },
  "/js/a.js": {
    "version": "64a14aef",
    "versionedUrl": "/js/a.js?v=64a14aef"
  },
  "/js/b.js": {
    "version": "0761aa10",
    "versionedUrl": "/js/b.js?v=0761aa10"
  }
};


;(function() {
  var __versionMappings__ = {
    "/js/a.js": "/js/a.js?v=64a14aef",
    "/js/b.js": "/js/b.js?v=0761aa10"
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

self.addEventListener("message", async (messageEvent) => {
  if (messageEvent.data === "inspect") {
    messageEvent.ports[0].postMessage({
      order: self.order,
      resourcesFromJsenvBuild: self.resourcesFromJsenvBuild,
    });
  }
});

// trigger jsenv dynamic import for slicedToArray
const fn = ([a]) => {
  console.log(a);
};
fn(["a"]);
