;
(function () {
  var __versionMappings__ = {
    "/foo/": "/foo/?v=ffaebce2"
  };
  window.__v__ = function (specifier) {
    return __versionMappings__[specifier] || specifier;
  };
})();
export const fooDirectoryUrl = new URL(__v__("/foo/"), import.meta.url).href;