import { assert } from "@jsenv/assert";
import {
  copyDirectorySync,
  readFileStructureSync,
  writeFileStructureSync,
} from "@jsenv/filesystem";

import { takeDirectorySnapshot } from "@jsenv/snapshot";

const fixturesDirectoryUrl = new URL("./fixtures/", import.meta.url);
const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);
const snapshotDirectoryFileStructureBeforeTest = readFileStructureSync(
  snapshotsDirectoryUrl,
);

try {
  const directorySnapshot = takeDirectorySnapshot(snapshotsDirectoryUrl);
  copyDirectorySync({
    from: fixturesDirectoryUrl,
    to: snapshotsDirectoryUrl,
    overwrite: true,
  });
  directorySnapshot.compare();
  throw new Error("should throw");
} catch (e) {
  const actual = e.message;
  const expected = `comparison with previous directory snapshot failed
--- reason ---
"file.txt" is missing
--- file missing ---
${snapshotsDirectoryUrl}file.txt`;
  assert({ actual, expected });
} finally {
  writeFileStructureSync(
    snapshotsDirectoryUrl,
    snapshotDirectoryFileStructureBeforeTest,
  );
}
