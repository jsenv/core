import { assert } from "@jsenv/assert";

import {
  compareSnapshotTakenByFunction,
  readDirectoryContent,
  writeDirectoryContent,
} from "@jsenv/snapshot";

const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);
const contentBeforeTest = readDirectoryContent(snapshotsDirectoryUrl);

try {
  await compareSnapshotTakenByFunction(snapshotsDirectoryUrl, () => {
    writeDirectoryContent(snapshotsDirectoryUrl, {
      "a.js": `console.log('b');\n`,
    });
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

  const aFileContentInSnapshotDirectory = readDirectoryContent(
    snapshotsDirectoryUrl,
  )["a.js"];
  assert({
    actual: aFileContentInSnapshotDirectory,
    expected: `console.log('b');\n`,
  });
} finally {
  writeDirectoryContent(snapshotsDirectoryUrl, contentBeforeTest);
}
