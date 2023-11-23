import {
  ensureEmptyDirectorySync,
  copyDirectoryContentSync,
} from "@jsenv/filesystem";

import { takeDirectorySnapshot, compareSnapshots } from "@jsenv/snapshot";

const fixturesDirectoryUrl = new URL("./fixtures/", import.meta.url);
const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);

ensureEmptyDirectorySync(snapshotsDirectoryUrl);
try {
  const expectedDirectorySnapshot = takeDirectorySnapshot(
    snapshotsDirectoryUrl,
  );
  copyDirectoryContentSync({
    from: fixturesDirectoryUrl,
    to: snapshotsDirectoryUrl,
  });
  const actualDirectorySnapshot = takeDirectorySnapshot(snapshotsDirectoryUrl);
  compareSnapshots(actualDirectorySnapshot, expectedDirectorySnapshot);
} finally {
  ensureEmptyDirectorySync(snapshotsDirectoryUrl);
}
