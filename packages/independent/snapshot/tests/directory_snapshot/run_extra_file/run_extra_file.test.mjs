import { assert } from "@jsenv/assert";
import {
  readDirectoryStructureSync,
  writeDirectoryStructureSync,
} from "@jsenv/filesystem";

import { takeDirectorySnapshot } from "@jsenv/snapshot";

const sourceDirectoryUrl = new URL("./source/", import.meta.url);
const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);

const sourceDirectoryStructureBeforeTest =
  readDirectoryStructureSync(sourceDirectoryUrl);
const snapshotDirectoryStructureBeforeTest = readDirectoryContent(
  snapshotsDirectoryUrl,
);

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
  writeDirectoryStructureSync(
    sourceDirectoryUrl,
    sourceDirectoryStructureBeforeTest,
  );
  writeDirectoryStructureSync(
    snapshotsDirectoryUrl,
    snapshotDirectoryStructureBeforeTest,
  );
}
