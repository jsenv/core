import { assert } from "@jsenv/assert";
import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";

// TOFIX: actual display 3 remaining props while expect display 4 remaining props
// they must hide the same number of props

await startSnapshotTesting("advanced", ({ test }) => {
  test.ONLY("johan", () => {
    assert({
      actual: {
        a: false,
        b: true,
        ACTUAL_NEW_1: true,
        c: true,
        d: true,
        e: true,
        f: true,
      },
      expect: {
        a: false,
        EXPECT_NEW_1: true,
        b: true,
        c: false,
        d: false,
        e: false,
        f: false,
      },
      MAX_DIFF_INSIDE_VALUE: 1,
      MAX_CONTEXT_AFTER_DIFF: 2,
      MAX_CONTEXT_BEFORE_DIFF: 2,
    });
  });
});
