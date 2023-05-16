System.register([], function (_export, _context) {
  "use strict";

  var globalObject;
  return {
    setters: [],
    execute: function () {
      /* eslint-env browser,node */
      globalObject = typeof self === "object" ? self : process;
      globalObject.__InlineContent__ = function (content, {
        type = "text/plain"
      }) {
        this.text = content;
        this.type = type;
      };
    }
  };
});