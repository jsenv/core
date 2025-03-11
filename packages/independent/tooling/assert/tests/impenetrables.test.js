import { assert } from "@jsenv/assert";
import { snapshotAssertTests } from "@jsenv/assert/tests/snapshot_assert.js";

await snapshotAssertTests(import.meta.url, ({ test }) => {
  test("promise", () => {
    assert({
      actual: {
        a: true,
        b: Promise.resolve(40),
      },
      expect: {
        a: false,
        b: Promise.resolve(42),
      },
    });
  });
  test("weakset", () => {
    assert({
      actual: {
        a: true,
        b: new WeakSet([{}, [], Symbol.iterator]),
      },
      expect: {
        a: false,
        b: new WeakSet([Symbol.iterator]),
      },
    });
  });
  test("weakmap", () => {
    assert({
      actual: {
        a: true,
        b: new WeakMap([
          [{}, "object"],
          [[], "array"],
          [Symbol.iterator, { yes: true }],
        ]),
      },
      expect: {
        a: false,
        b: new WeakMap([[{}, "toto"]]),
      },
    });
  });
});
