System.register(["./generator.js"], function (_export, _context) {
  "use strict";

  var generateZeroAndOne, generator, actual, expected, actual, expected, actual, expected;
  return {
    setters: [function (_generatorJs) {
      generateZeroAndOne = _generatorJs.generateZeroAndOne;
    }],
    execute: function () {
      generator = generateZeroAndOne();
      {
        actual = generator.next().value;
        expected = 0;

        if (actual !== expected) {
          throw new Error(`generateZeroAndOne() must yield 0, got ${actual}`);
        }
      }
      {
        actual = generator.next().value;
        expected = 1;

        if (actual !== expected) {
          throw new Error(`generateZeroAndOne() must yield 1, got ${actual}`);
        }
      }
      {
        actual = generator.next().done;
        expected = true;

        if (actual !== expected) {
          throw new Error(`generateZeroAndOne() must be done after yielding 1`);
        }
      }
    }
  };
});
//# sourceMappingURL=./generator.spec.js__asset__/generator.spec.js.map