;
(function () {
  var __versionMappings__ = {
    "/js/fire.js": "/js/fire.js?v=e1a844b5",
    "/js/water.js": "/js/water.js?v=4610ad74"
  };
  window.__v__ = function (specifier) {
    return __versionMappings__[specifier] || specifier;
  };
})();
import(__v__("/js/fire.js"));
import(__v__("/js/water.js"));