import { takeDirectorySnapshot, compareSnapshots } from "@jsenv/snapshot";

if (process.env.CI) {
  // https certificate not trusted on CI, see https://github.com/jsenv/https-local/issues/9
  process.exit(0);
}

const snapshotDirectoryUrl = new URL("./snapshots/html/", import.meta.url);
const expectedSnapshots = takeDirectorySnapshot(snapshotDirectoryUrl);
process.env.FROM_TESTS = "true";
await import("./errors_snapshots.mjs");
const actualSnapshots = takeDirectorySnapshot(snapshotDirectoryUrl);
compareSnapshots(actualSnapshots, expectedSnapshots);
