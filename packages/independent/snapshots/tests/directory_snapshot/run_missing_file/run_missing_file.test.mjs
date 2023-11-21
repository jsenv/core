import { assert } from "@jsenv/assert";

import {
  takeDirectorySnapshot,
  readDirectoryContent,
  writeDirectoryContent,
} from "@jsenv/snapshots";

const sourceDirectoryUrl = new URL("./source/", import.meta.url);
const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);

const sourceContentBeforeTest = readDirectoryContent(sourceDirectoryUrl);
const snapshotContentBeforeTest = readDirectoryContent(snapshotsDirectoryUrl);

try {
  takeDirectorySnapshot(sourceDirectoryUrl, snapshotsDirectoryUrl);
  throw new Error("should throw");
} catch (e) {
  const actual = e.message;
  const expected = `comparison with previous snapshot failed
--- reason ---
"file.txt" is missing
--- snapshot directory url ---
${snapshotsDirectoryUrl}`;
  assert({ actual, expected });

  const bFileContentInSnapshotDirectory = readDirectoryContent(
    snapshotsDirectoryUrl,
  )["b.js"];
  assert({
    actual: bFileContentInSnapshotDirectory,
    expected: `console.log("c");\n`,
  });
} finally {
  writeDirectoryContent(sourceDirectoryUrl, sourceContentBeforeTest);
  writeDirectoryContent(snapshotsDirectoryUrl, snapshotContentBeforeTest);
}
