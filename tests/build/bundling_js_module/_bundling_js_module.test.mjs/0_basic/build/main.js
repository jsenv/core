;
(function () {
  var __versionMappings__ = {
    "/js/fire.js": "/js/fire.js?v=5688ae4f",
    "/js/water.js": "/js/water.js?v=3bf014fe"
  };
  window.__v__ = function (specifier) {
    return __versionMappings__[specifier] || specifier;
  };
})();
import(__v__("/js/fire.js"));
import(__v__("/js/water.js"));