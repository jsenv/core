import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";
import { assert } from "@jsenv/assert";

await startSnapshotTesting("assert_between", {
  between: () => {
    assert({
      actual: 150,
      expected: assert.between(100, 200),
    });
  },
  fail_on_string: () => {
    assert({
      actual: "toto",
      expected: assert.between(100, 200),
    });
  },
  fail_too_small: () => {
    assert({
      actual: 50,
      expected: assert.between(100, 200),
    });
  },
  fail_too_big: () => {
    assert({
      actual: 250,
      expected: assert.between(100, 200),
    });
  },
});
