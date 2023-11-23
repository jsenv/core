import { copyDirectorySync } from "@jsenv/filesystem";

import { takeDirectorySnapshot, compareSnapshots } from "@jsenv/snapshot";

const fixturesDirectoryUrl = new URL("./fixtures/", import.meta.url);
const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);

const actualDirectorySnapshot = takeDirectorySnapshot(snapshotsDirectoryUrl);
copyDirectorySync({
  from: fixturesDirectoryUrl,
  to: snapshotsDirectoryUrl,
  overwrite: true,
});
const expectedDirectorySnapshot = takeDirectorySnapshot(snapshotsDirectoryUrl);
compareSnapshots(actualDirectorySnapshot, expectedDirectorySnapshot);
