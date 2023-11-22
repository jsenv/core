import { assert } from "@jsenv/assert";

import {
  takeDirectorySnapshotAndCompare,
  takeDirectorySnapshot,
  saveDirectorySnapshot,
} from "@jsenv/snapshot";

const sourceDirectoryUrl = new URL("./source/", import.meta.url);
const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);

const sourceBeforeTestSnapshot = takeDirectorySnapshot(sourceDirectoryUrl);
const snapshotBeforeTestSnapshot = takeDirectorySnapshot(snapshotsDirectoryUrl);

try {
  takeDirectorySnapshotAndCompare(sourceDirectoryUrl, snapshotsDirectoryUrl);
  throw new Error("should throw");
} catch (e) {
  const actual = e.message;
  const expected = `comparison with previous snapshot failed
--- reason ---
"file.txt" is missing
--- file missing ---
${snapshotsDirectoryUrl}file.txt`;
  assert({ actual, expected });

  const filesInSnapshotsDirectory = Object.keys(
    takeDirectorySnapshot(snapshotsDirectoryUrl),
  );
  assert({
    actual: filesInSnapshotsDirectory,
    expected: ["a.js", "b.js"],
  });
} finally {
  saveDirectorySnapshot(sourceDirectoryUrl, sourceBeforeTestSnapshot);
  saveDirectorySnapshot(snapshotsDirectoryUrl, snapshotBeforeTestSnapshot);
}
