import { assert } from "@jsenv/assert";
import { removeEntry } from "@jsenv/filesystem";

import {
  takeDirectorySnapshotAndCompare,
  takeDirectorySnapshot,
} from "@jsenv/snapshot";

const sourceDirectoryUrl = new URL("./source/", import.meta.url);
const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);

removeEntry(snapshotsDirectoryUrl, { recursive: true, allowUseless: true });
try {
  takeDirectorySnapshotAndCompare(sourceDirectoryUrl, snapshotsDirectoryUrl);
  const snapshotDirectorySnapshot = takeDirectorySnapshot(
    snapshotsDirectoryUrl,
  );
  const actual = snapshotDirectorySnapshot;
  const expected = {
    "a.js": `console.log("a");\n`,
    "b.js": `console.log("b");\n`,
    "file.txt": "hello",
  };
  assert({ actual, expected });
} finally {
  removeEntry(snapshotsDirectoryUrl, { recursive: true });
}
