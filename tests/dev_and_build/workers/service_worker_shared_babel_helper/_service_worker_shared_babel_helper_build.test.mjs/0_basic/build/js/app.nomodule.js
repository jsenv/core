System.register([], function (_export, _context) {
  "use strict";

  return {
    setters: [],
    execute: function () {
      window.navigator.serviceWorker.register(new URL("/service_worker.nomodule.js", _context.meta.url), {
        type: "classic"
      });
    }
  };
});