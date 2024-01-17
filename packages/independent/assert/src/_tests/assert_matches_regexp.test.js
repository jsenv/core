import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";
import { assert } from "@jsenv/assert";

await startSnapshotTesting("assert_matches_regexp", {
  matching: () => {
    assert({
      actual: "expired 3 seconds ago",
      expected: assert.matchesRegExp(/expired \d seconds ago/),
    });
  },
  fail_to_match: () => {
    assert({
      actual: "expired n seconds ago",
      expected: assert.matchesRegExp(/expired \d seconds ago/),
    });
  },
});
