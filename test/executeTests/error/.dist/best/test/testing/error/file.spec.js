System.register(["./file.js"], function (_export, _context) {
  "use strict";

  var ask, actual, expected;
  return {
    setters: [function (_fileJs) {
      ask = _fileJs.ask;
    }],
    execute: function () {
      actual = ask();
      expected = 42;

      if (actual !== expected) {
        throw new Error(`ask() should return ${expected}, got ${actual}`);
      }
    }
  };
});
//# sourceMappingURL=./file.spec.js__asset__/file.spec.js.map