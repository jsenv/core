import {
  readSnapshotsFromDirectory,
  assertSnapshots,
} from "@jsenv/core/tests/snapshots_directory.js";

const expected = readSnapshotsFromDirectory(
  new URL("./snapshots/", import.meta.url),
);
await import("./execution_logs_snapshots.mjs");
const actual = readSnapshotsFromDirectory(
  new URL("./snapshots/", import.meta.url),
);
assertSnapshots({
  actual,
  expected,
});
