;
(function () {
  var __versionMappings__ = {
    "/json/package.json": "/json/package.json?v=b268204a"
  };
  window.__v__ = function (specifier) {
    return __versionMappings__[specifier] || specifier;
  };
})();
const resolvePackageName = new URL("/index.js", import.meta.url).href;
const resolvePackageSubpath = new URL(__v__("/json/package.json"), import.meta.url).href;
export { resolvePackageName, resolvePackageSubpath };