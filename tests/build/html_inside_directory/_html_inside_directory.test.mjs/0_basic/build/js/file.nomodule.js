System.register([], function (_export, _context) {
  "use strict";

  return {
    setters: [],
    execute: function () {
      console.log("Hello world");
      window.resolveResultPromise(42);
    }
  };
});