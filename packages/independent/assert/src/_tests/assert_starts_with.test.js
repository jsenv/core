import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";
import { assert } from "@jsenv/assert";

await startSnapshotTesting("assert_starts_with", {
  starts_with: () => {
    assert({
      actual: "AABB",
      expected: assert.startsWith("AAB"),
    });
  },
  fail_to_start_with: () => {
    assert({
      actual: "AABB",
      expected: assert.startsWith("AB"),
    });
  },
});
