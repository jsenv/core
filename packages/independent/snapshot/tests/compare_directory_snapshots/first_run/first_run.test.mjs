import { ensureEmptyDirectorySync, copyDirectorySync } from "@jsenv/filesystem";

import { takeDirectorySnapshot, compareSnapshots } from "@jsenv/snapshot";

const fixturesDirectoryUrl = new URL("./fixtures/", import.meta.url);
const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);

ensureEmptyDirectorySync(snapshotsDirectoryUrl);
try {
  const expectedDirectorySnapshot = takeDirectorySnapshot(
    snapshotsDirectoryUrl,
  );
  copyDirectorySync({
    from: fixturesDirectoryUrl,
    to: snapshotsDirectoryUrl,
    overwrite: true,
  });
  const actualDirectorySnapshot = takeDirectorySnapshot(snapshotsDirectoryUrl);
  compareSnapshots(actualDirectorySnapshot, expectedDirectorySnapshot);
} finally {
  ensureEmptyDirectorySync(snapshotsDirectoryUrl);
}
