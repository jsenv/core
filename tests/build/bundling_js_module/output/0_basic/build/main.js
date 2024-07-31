;
(function () {
  var __versionMappings__ = {
    "/js/fire.js": "/js/fire.js?v=64cd62b7",
    "/js/water.js": "/js/water.js?v=90240d37"
  };
  window.__v__ = function (specifier) {
    return __versionMappings__[specifier] || specifier;
  };
})();
import(__v__("/js/fire.js"));
import(__v__("/js/water.js"));