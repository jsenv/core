;
(function () {
  var __versionMappings__ = {
    "/src/sub/": "/src/sub/?v=empty"
  };
  window.__v__ = function (specifier) {
    return __versionMappings__[specifier] || specifier;
  };
})();
export const subDirectoryUrl = new URL(__v__("/src/sub/"), import.meta.url).href;