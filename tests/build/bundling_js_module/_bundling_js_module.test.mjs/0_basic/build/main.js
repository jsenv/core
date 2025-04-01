;
(function () {
  var __versionMappings__ = {
    "/js/fire.js": "/js/fire.js?v=2c8724f2",
    "/js/water.js": "/js/water.js?v=2de3c143"
  };
  window.__v__ = function (specifier) {
    return __versionMappings__[specifier] || specifier;
  };
})();
import(__v__("/js/fire.js"));
import(__v__("/js/water.js"));