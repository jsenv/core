;
(function () {
  var __versionMappings__ = {};
  window.__v__ = function (specifier) {
    return __versionMappings__[specifier] || specifier;
  };
})();
export const rootDirectoryUrl = new URL("/", import.meta.url).href;
export const fooDirectoryUrl = new URL("/foo/", import.meta.url).href;