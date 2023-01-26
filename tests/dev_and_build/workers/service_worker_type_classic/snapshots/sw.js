
self.serviceWorkerUrls = {
  "/main.html": {
    "versioned": false,
    "version": "ceb7c6c8"
  },
  "/css/style.css?v=0e312da1": {
    "versioned": true
  },
  "/js/a.js?v=acc03e99": {
    "versioned": true
  },
  "/js/b.js?v=7342c38c": {
    "versioned": true
  }
};

;(function() {
  var __versionMappings__ = {
  "/js/a.js": "/js/a.js?v=acc03e99",
  "/js/b.js": "/js/b.js?v=7342c38c"
};
  self.__v__ = function (specifier) {
    return __versionMappings__[specifier] || specifier
  };
})();
/* globals self, importScripts */

self.order = [];
self.order.push("before-a");
importScripts(__v__("/js/a.js"));
self.order.push("after-a");
self.addEventListener("message", async messageEvent => {
  if (messageEvent.data === "inspect") {
    messageEvent.ports[0].postMessage({
      order: self.order,
      serviceWorkerUrls: self.serviceWorkerUrls
    });
  }
});

// trigger jsenv dynamic import for slicedToArray
const fn = ([a]) => {
  console.log(a);
};
fn(["a"]);