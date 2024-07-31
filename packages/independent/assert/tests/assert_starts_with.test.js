import { assert } from "@jsenv/assert";
import { snapshotAssertTests } from "@jsenv/assert/tests/snapshot_assert.js";

await snapshotAssertTests(import.meta.url, ({ test }) => {
  test("no diff", () => {
    assert({
      actual: {
        a: "AABB",
        b: true,
      },
      expect: {
        a: assert.startsWith("AAB"),
        b: false,
      },
    });
  });
  test("does not start with", () => {
    assert({
      actual: "AABB",
      expect: assert.startsWith("AB"),
    });
  });
});
