import { startSnapshotTesting } from "./start_snapshot_testing.js";
import { assert } from "@jsenv/assert";

const dateSnapshotTesting = startSnapshotTesting("date");

assert({
  actual: new Date(10),
  expected: new Date(10),
});

try {
  assert({
    actual: new Date(10),
    expected: new Date(11),
  });
} catch (e) {
  dateSnapshotTesting.writeError(e, "date_fail.txt");
}
