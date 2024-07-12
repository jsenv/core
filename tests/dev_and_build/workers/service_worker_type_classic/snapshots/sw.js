self.resourcesFromJsenvBuild = {
  "/main.html": {
    "version": "090593aa"
  },
  "/css/style.css": {
    "version": "2e9d11a2",
    "versionedUrl": "/css/style.css?v=2e9d11a2"
  },
  "/js/a.js": {
    "version": "76c9c177",
    "versionedUrl": "/js/a.js?v=76c9c177"
  },
  "/js/b.js": {
    "version": "54f517a9",
    "versionedUrl": "/js/b.js?v=54f517a9"
  }
};


;(function() {
  var __versionMappings__ = {
    "/js/a.js": "/js/a.js?v=76c9c177",
    "/js/b.js": "/js/b.js?v=54f517a9"
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