import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";
import { executeInNewContext } from "./utils/executeInNewContext.js";
import { assert } from "@jsenv/assert";

await startSnapshotTesting("array", {
  basic: () => {
    assert({
      actual: [],
      expected: [],
    });
  },
  equal_zeros: () => {
    assert({
      actual: [0],
      expected: [0],
    });
  },
  cross_realm: async () => {
    assert({
      actual: await executeInNewContext("[]"),
      expected: [],
    });
  },
  fail_array_too_big: () => {
    assert({
      actual: [0, 1],
      expected: [0],
    });
  },
  fail_array_too_small: () => {
    assert({
      actual: [0],
      expected: [0, 1],
    });
  },
  fail_string_at_0: () => {
    assert({
      actual: ["a"],
      expected: ["b"],
    });
  },
  fail_prototype: () => {
    assert({
      actual: {},
      expected: [],
    });
  },
  fail_array_like_length: () => {
    assert({
      actual: { length: 0 },
      expected: { length: 1 },
    });
  },
  fail_array_property: () => {
    const actual = [];
    actual.foo = true;
    const expected = [];
    expected.foo = false;
    assert({ actual, expected });
  },
  fail_array_symbol: () => {
    const symbol = Symbol();
    const actual = [];
    actual[symbol] = true;
    const expected = [];
    expected[symbol] = false;
    assert({ actual, expected });
  },
});
