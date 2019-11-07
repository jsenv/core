System.register([], function (_export, _context) {
  "use strict";

  return {
    setters: [],
    execute: async function () {
      if (process.env.AWAIT_FOREVER) {
        await new Promise(() => {});
      }
    }
  };
});
//# sourceMappingURL=./timeout.js__asset__/timeout.js.map