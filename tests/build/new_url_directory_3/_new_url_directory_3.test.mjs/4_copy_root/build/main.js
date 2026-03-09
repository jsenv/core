;
(function () {
  var __versionMappings__ = {
    "/": "/?v=2f2c8578"
  };
  window.__v__ = function (specifier) {
    return __versionMappings__[specifier] || specifier;
  };
})();
export const rootDirectoryUrl = new URL(__v__("/"), import.meta.url).href;