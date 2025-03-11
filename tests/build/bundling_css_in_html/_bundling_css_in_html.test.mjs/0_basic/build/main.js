;
(function () {
  var __versionMappings__ = {
    "/html/main.html": "/html/main.html?v=fef7fda1"
  };
  window.__v__ = function (specifier) {
    return __versionMappings__[specifier] || specifier;
  };
})();
const htmlUrl = new URL(__v__("/html/main.html"), import.meta.url);
console.log(htmlUrl);