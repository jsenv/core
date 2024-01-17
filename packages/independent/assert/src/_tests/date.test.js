import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";
import { assert } from "@jsenv/assert";

await startSnapshotTesting("date", {
  basic: () => {
    assert({
      actual: new Date(10),
      expected: new Date(10),
    });
  },
  fail_on_first_arg: () => {
    assert({
      actual: new Date(10),
      expected: new Date(11),
    });
  },
});
