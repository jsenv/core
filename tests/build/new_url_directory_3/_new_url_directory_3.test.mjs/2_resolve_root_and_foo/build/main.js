;
(function () {
  var __versionMappings__ = {
    "/": "/?v=1152d73e",
    "/foo/": "/foo/?v=empty"
  };
  window.__v__ = function (specifier) {
    return __versionMappings__[specifier] || specifier;
  };
})();
export const rootDirectoryUrl = new URL(__v__("/"), import.meta.url).href;
export const fooDirectoryUrl = new URL(__v__("/foo/"), import.meta.url).href;