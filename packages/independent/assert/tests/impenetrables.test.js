import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";

await startSnapshotTesting("impenetrables", ({ test }) => {
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
