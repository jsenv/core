import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";

await startSnapshotTesting("assert_starts_with", ({ test }) => {
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
