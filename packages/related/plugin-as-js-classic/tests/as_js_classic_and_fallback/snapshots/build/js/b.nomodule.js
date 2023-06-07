System.register([], function (_export, _context) {
  "use strict";

  var answer;
  return {
    setters: [],
    execute: function () {
      answer = 42;
      console.log(`b: ${answer}`);
      window.b = answer;
    }
  };
});