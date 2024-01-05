;
(function () {
  var __versionMappings__ = {
    "/json/package.json": "/json/package.json?v=b268204a"
  };
  window.__v__ = function (specifier) {
    return __versionMappings__[specifier] || specifier;
  };
})();
const resolvePackageName = import.meta.resolve("/index.js");
const resolvePackageSubpath = import.meta.resolve(__v__("/json/package.json"));
export { resolvePackageName, resolvePackageSubpath };