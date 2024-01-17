import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";
import { assert } from "@jsenv/assert";

await startSnapshotTesting("assert_not", {
  _41_is_not_42: () => {
    assert({
      actual: 41,
      expected: assert.not(42),
    });
  },
  negative_zero_is_not_zero: () => {
    assert({
      actual: -0,
      expected: assert.not(0),
    });
  },
  zero_is_not_negative_zero: () => {
    assert({
      actual: 0,
      expected: assert.not(-0),
    });
  },
  fail_on_negative_zero: () => {
    assert({
      actual: -0,
      expected: assert.not(-0),
    });
  },
  fail_on_42: () => {
    assert({
      actual: 42,
      expected: assert.not(42),
    });
  },
});
