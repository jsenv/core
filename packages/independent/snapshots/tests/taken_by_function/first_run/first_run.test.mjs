import { assert } from "@jsenv/assert";
import { removeEntry } from "@jsenv/filesystem";

import {
  assertSnapshotDirectoryTakenByFunction,
  writeDirectoryContent,
  readDirectoryContent,
} from "@jsenv/snapshots";

const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);

removeEntry(snapshotsDirectoryUrl, { recursive: true, allowUseless: true });
try {
  await assertSnapshotDirectoryTakenByFunction(snapshotsDirectoryUrl, () => {
    writeDirectoryContent(snapshotsDirectoryUrl, {
      "a.js": `console.log("a");\n`,
    });
  });
  const snapshotDirectoryContent = readDirectoryContent(snapshotsDirectoryUrl);
  const actual = snapshotDirectoryContent;
  const expected = {
    "a.js": `console.log("a");\n`,
  };
  assert({ actual, expected });
} finally {
  removeEntry(snapshotsDirectoryUrl, { recursive: true });
}
