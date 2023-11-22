import { assert } from "@jsenv/assert";
import { removeEntry } from "@jsenv/filesystem";

import {
  compareSnapshotTakenByFunction,
  saveSnapshotOnFileSystem,
  takeDirectorySnapshot,
} from "@jsenv/snapshot";

const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);

removeEntry(snapshotsDirectoryUrl, { recursive: true, allowUseless: true });
try {
  await compareSnapshotTakenByFunction(snapshotsDirectoryUrl, () => {
    saveSnapshotOnFileSystem(
      {
        "a.js": `console.log("a");\n`,
      },
      snapshotsDirectoryUrl,
    );
  });
  const snapshotDirectoryContent = takeDirectorySnapshot(snapshotsDirectoryUrl);
  const actual = snapshotDirectoryContent;
  const expected = {
    "a.js": `console.log("a");\n`,
  };
  assert({ actual, expected });
} finally {
  removeEntry(snapshotsDirectoryUrl, { recursive: true });
}
