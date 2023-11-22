import { assert } from "@jsenv/assert";

import {
  takeDirectorySnapshot,
  readDirectoryContent,
  writeDirectoryContent,
} from "@jsenv/snapshot";

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
2 files are unexpected
--- files unexpected ---
${snapshotsDirectoryUrl}file.txt
${snapshotsDirectoryUrl}hello.js`;
  assert({ actual, expected });

  const filesInSnapshotsDirectory = Object.keys(
    readDirectoryContent(snapshotsDirectoryUrl),
  );
  assert({
    actual: filesInSnapshotsDirectory,
    expected: ["a.js", "b.js", "file.txt", "hello.js"],
  });
} finally {
  writeDirectoryContent(sourceDirectoryUrl, sourceContentBeforeTest);
  writeDirectoryContent(snapshotsDirectoryUrl, snapshotContentBeforeTest);
}
