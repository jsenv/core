import { assert } from "@jsenv/assert";
import { removeEntry } from "@jsenv/filesystem";

import {
  compareSnapshotTakenByFunction,
  saveDirectorySnapshot,
  takeDirectorySnapshot,
} from "@jsenv/snapshot";

const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);

removeEntry(snapshotsDirectoryUrl, { recursive: true, allowUseless: true });
try {
  await compareSnapshotTakenByFunction(snapshotsDirectoryUrl, () => {
    saveDirectorySnapshot(snapshotsDirectoryUrl, {
      "a.js": `console.log("a");\n`,
    });
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
