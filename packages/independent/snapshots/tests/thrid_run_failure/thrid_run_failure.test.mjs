import { assert } from "@jsenv/assert";

import {
  takeDirectorySnapshot,
  readSnapshotsFromDirectory,
  writeSnapshotsIntoDirectory,
} from "@jsenv/snapshots";

const sourceDirectoryUrl = new URL("./source/", import.meta.url);
const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);

const contentBeforeTest = readSnapshotsFromDirectory(snapshotsDirectoryUrl);

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
actual["b.js"][13]
--- context ---
${snapshotsDirectoryUrl}`;
  assert({ actual, expected });
} finally {
  writeSnapshotsIntoDirectory(snapshotsDirectoryUrl, contentBeforeTest);
}
