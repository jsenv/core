import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";

await startSnapshotTesting("assert_matches", ({ test }) => {
  test("works", () => {
    assert({
      actual: {
        a: "expired 3 seconds ago",
        b: true,
      },
      expect: {
        a: assert.matches(/expired \d seconds ago/),
        b: false,
      },
    });
  });
  test("does not", () => {
    assert({
      actual: "expired n seconds ago",
      expect: assert.matches(/expired \d seconds ago/),
    });
  });
});
