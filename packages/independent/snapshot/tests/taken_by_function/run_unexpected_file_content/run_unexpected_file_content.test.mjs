import { assert } from "@jsenv/assert";

import {
  compareSnapshotTakenByFunction,
  takeDirectorySnapshot,
  saveSnapshotOnFileSystem,
} from "@jsenv/snapshot";

const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);
const contentBeforeTestSnapshot = takeDirectorySnapshot(snapshotsDirectoryUrl);

try {
  await compareSnapshotTakenByFunction(snapshotsDirectoryUrl, () => {
    saveSnapshotOnFileSystem(
      {
        "a.js": `console.log('b');\n`,
      },
      snapshotsDirectoryUrl,
    );
  });
  throw new Error("should throw");
} catch (e) {
  const actual = e.message;
  const expected = `comparison with previous snapshot failed
--- reason ---
unexpected character in "a.js" content
--- details ---
console.log('b');
            ^ unexpected "'", expected to continue with '"a");'…
--- path ---
[12]
--- file ---
${snapshotsDirectoryUrl}a.js`;
  assert({ actual, expected });

  const aFileContentInSnapshotDirectory = takeDirectorySnapshot(
    snapshotsDirectoryUrl,
  )["a.js"];
  assert({
    actual: aFileContentInSnapshotDirectory,
    expected: `console.log('b');\n`,
  });
} finally {
  saveSnapshotOnFileSystem(contentBeforeTestSnapshot, snapshotsDirectoryUrl);
}
