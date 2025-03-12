;(function() {
  var __versionMappings__ = {
    "/js/foo_index.js": "/js/foo_index.js?v=ec8d3df4"
  };
  self.__v__ = function (specifier) {
    return __versionMappings__[specifier] || specifier
  };
})();

self.importScripts(__v__("/js/foo_index.js"));

self.addEventListener("message", (e) => {
  if (e.data === "ping") {
    self.postMessage(self.answer);
  }
});
