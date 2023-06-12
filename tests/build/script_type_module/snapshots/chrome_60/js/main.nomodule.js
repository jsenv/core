System.register([], function (_export, _context) {
  "use strict";

  var answer;
  return {
    setters: [],
    execute: function () {
      answer = 42;
      setTimeout(() => {
        const url = _context.meta.url;
        window.resolveResultPromise({
          answer,
          url
        });
      }, 100);
    }
  };
});