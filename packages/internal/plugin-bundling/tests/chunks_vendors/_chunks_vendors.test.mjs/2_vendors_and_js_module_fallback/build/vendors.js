System.register([], function (_export, _context) {
  "use strict";

  var answer;
  return {
    setters: [],
    execute: function () {
      _export("answer", answer = 42);
      console.log("a.js");
    }
  };
});