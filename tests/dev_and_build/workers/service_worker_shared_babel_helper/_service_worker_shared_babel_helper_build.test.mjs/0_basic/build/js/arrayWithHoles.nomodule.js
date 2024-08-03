System.register([], function (_export, _context) {
  "use strict";

  return {
    setters: [],
    execute: function () {
      // eslint-disable-next-line consistent-return
      _export("default", arr => {
        if (Array.isArray(arr)) return arr;
      });
    }
  };
});