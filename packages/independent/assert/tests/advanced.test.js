import { assert } from "@jsenv/assert";
import { snapshotAssertTests } from "@jsenv/assert/tests/snapshot_assert.js";

await snapshotAssertTests(import.meta.url, ({ test }) => {
  test("johan", () => {
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
      MAX_DIFF_PER_VALUE: 2,
      MAX_CONTEXT_AFTER_DIFF: 2,
      MAX_CONTEXT_BEFORE_DIFF: 2,
    });
  });
});
