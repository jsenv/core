import { ensureEmptyDirectorySync, copyDirectorySync } from "@jsenv/filesystem";

import { takeDirectorySnapshot } from "@jsenv/snapshot";

const fixturesDirectoryUrl = new URL("./fixtures/", import.meta.url);
const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);

ensureEmptyDirectorySync(snapshotsDirectoryUrl);
try {
  const directorySnapshot = takeDirectorySnapshot(snapshotsDirectoryUrl);
  copyDirectorySync({
    from: fixturesDirectoryUrl,
    to: snapshotsDirectoryUrl,
    overwrite: true,
  });
  directorySnapshot.compare();
} finally {
  ensureEmptyDirectorySync(snapshotsDirectoryUrl);
}
