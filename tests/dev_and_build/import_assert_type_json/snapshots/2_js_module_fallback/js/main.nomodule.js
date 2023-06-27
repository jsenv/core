System.register([], function (_export, _context) {
  "use strict";

  var data;
  return {
    setters: [],
    execute: function () {
      data = JSON.parse("{\n  \"answer\": 42\n}");
      window.resolveResultPromise({
        data
      });
    }
  };
});