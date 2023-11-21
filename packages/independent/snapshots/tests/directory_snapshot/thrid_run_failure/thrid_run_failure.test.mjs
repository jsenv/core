// TODO: also assert the content of snapshots/ is updated

import { assert } from "@jsenv/assert";

import {
  takeDirectorySnapshot,
  readDirectoryContent,
  writeDirectoryContent,
} from "@jsenv/snapshots";

const sourceDirectoryUrl = new URL("./source/", import.meta.url);
const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);

const contentBeforeTest = readDirectoryContent(snapshotsDirectoryUrl);

try {
  takeDirectorySnapshot(sourceDirectoryUrl, snapshotsDirectoryUrl);
  throw new Error("should throw");
} catch (e) {
  const actual = e.message;
  const expected = `unexpected character in string
--- details ---
console.log("c");
             ^ unexpected "c", expected to continue with 'b");'…
--- path ---
actual[13]
--- reason ---
file content does not match snapshot
--- file ---
${sourceDirectoryUrl}b.js
--- snapshot url ---
${snapshotsDirectoryUrl}b.js`;
  assert({ actual, expected });

  const bFileContentInSnapshotDirectory = readDirectoryContent(
    snapshotsDirectoryUrl,
  )["b.js"];
  assert({
    actual: bFileContentInSnapshotDirectory,
    expected: `console.log("c");\n`,
  });
} finally {
  writeDirectoryContent(snapshotsDirectoryUrl, contentBeforeTest);
}
