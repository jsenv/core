import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";
import { assert } from "@jsenv/assert";

await startSnapshotTesting("assert_close_to", {
  close: () => {
    assert({
      actual: 0.1 + 0.2,
      expected: assert.closeTo(0.3),
    });
  },
  fail_on_string: () => {
    assert({
      actual: "toto",
      expected: assert.closeTo(0.4),
    });
  },
  fail_to_be_close: () => {
    assert({
      actual: 0.1 + 0.2,
      expected: assert.closeTo(0.4),
    });
  },
});
