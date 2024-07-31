System.register([], function (_export, _context) {
  "use strict";

  return {
    setters: [],
    execute: function () {
      console.log("nested");
      window.resolveResultPromise({
        answer: 42,
        nestedFeatureUrl: window.nestedFeatureUrl
      });
    }
  };
});