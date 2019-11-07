System.register([], function (_export, _context) {
  "use strict";

  return {
    setters: [],
    execute: function () {
      _export("default", (() => {
        if (typeof window === "object") {
          return "browser";
        }

        if (typeof process === "object") {
          return "node";
        }

        return "other";
      })());
    }
  };
});
//# sourceMappingURL=./file.js__asset__/file.js.map