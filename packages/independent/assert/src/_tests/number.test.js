import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";
import { assert } from "@jsenv/assert";

await startSnapshotTesting("number", {
  same_numbers: () => {
    assert({
      actual: 10,
      expected: 10,
    });
  },
  infinity: () => {
    assert({
      actual: Infinity,
      expected: Infinity,
    });
  },
  negative_zero: () => {
    assert({
      actual: -0,
      expected: -0,
    });
  },
  fail_number: () => {
    assert({
      actual: 1,
      expected: 10,
    });
  },
  fail_infinity_instead_of_1: () => {
    assert({
      actual: Infinity,
      expected: 1,
    });
  },
  fail_nan_instead_of_1: () => {
    assert({
      actual: NaN,
      expected: 1,
    });
  },
  fail_negative_zero_instead_of_0: () => {
    assert({ actual: -0, expected: 0 });
  },
  fail_zero_instead_of_negative_0: () => {
    assert({ actual: 0, expected: -0 });
  },
  fail_negative_number: () => {
    assert({
      actual: 1,
      expected: -1,
    });
  },
});
