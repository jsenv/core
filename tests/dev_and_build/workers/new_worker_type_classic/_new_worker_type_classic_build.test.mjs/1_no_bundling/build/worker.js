;(function() {
  var __versionMappings__ = {
    "/js/ping.js": "/js/ping.js?v=267af9a7"
  };
  self.__v__ = function (specifier) {
    return __versionMappings__[specifier] || specifier
  };
})();

self.importScripts(__v__("/js/ping.js"));

self.addEventListener("message", (e) => {
  if (e.data === "ping") {
    self.postMessage(self.pingResponse);
  }
});
