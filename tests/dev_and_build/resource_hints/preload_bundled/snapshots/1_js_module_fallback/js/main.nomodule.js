System.register([], function (_export, _context) {
  "use strict";

  return {
    setters: [],
    execute: function () {
      console.log(42);
      window.resolveResultPromise(42);
    }
  };
});