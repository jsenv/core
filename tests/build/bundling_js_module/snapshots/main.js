;(function() {
  var __versionMappings__ = {
  "/js/fire.js": "/js/fire.js?v=4d8e3f01",
  "/js/water.js": "/js/water.js?v=5ec1d329"
};
  window.__v__ = function (specifier) {
    return __versionMappings__[specifier] || specifier
  };
})();

import(__v__("/js/fire.js"));
import(__v__("/js/water.js"));
