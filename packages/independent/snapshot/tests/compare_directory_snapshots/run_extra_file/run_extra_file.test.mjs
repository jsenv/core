import { assert } from "@jsenv/assert";
import {
  copyDirectoryContentSync,
  readFileStructureSync,
  writeFileStructureSync,
} from "@jsenv/filesystem";

import { takeDirectorySnapshot, compareSnapshots } from "@jsenv/snapshot";

const fixturesDirectoryUrl = new URL("./fixtures/", import.meta.url);
const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);

const snapshotDirectoryFileStructureBeforeTest = readFileStructureSync(
  snapshotsDirectoryUrl,
);

try {
  const expectedDirectorySnapshot = takeDirectorySnapshot(
    snapshotsDirectoryUrl,
  );
  copyDirectoryContentSync({
    from: fixturesDirectoryUrl,
    to: snapshotsDirectoryUrl,
    overwrite: true,
  });
  const actualDirectorySnapshot = takeDirectorySnapshot(snapshotsDirectoryUrl);
  compareSnapshots(actualDirectorySnapshot, expectedDirectorySnapshot);
  throw new Error("should throw");
} catch (e) {
  const actual = e.message;
  const expected = `comparison with previous directory snapshot failed
--- reason ---
2 files are unexpected
--- files unexpected ---
${snapshotsDirectoryUrl}file.txt
${snapshotsDirectoryUrl}hello.js`;
  assert({ actual, expected });
} finally {
  writeFileStructureSync(
    snapshotsDirectoryUrl,
    snapshotDirectoryFileStructureBeforeTest,
  );
}
