import { takeDirectorySnapshot, compareSnapshots } from "@jsenv/snapshot";

if (process.platform === "win32") {
  // disable on windows because it would fails due to line endings (CRLF)
  process.exit(0);
}

const snapshotDirectoryUrl = new URL("./snapshots/", import.meta.url);
const expectedSnapshots = takeDirectorySnapshot(snapshotDirectoryUrl);
process.env.FROM_TESTS = "true";
await import("./generate_snapshot_files.mjs");
const actualSnapshots = takeDirectorySnapshot(snapshotDirectoryUrl);
compareSnapshots(actualSnapshots, expectedSnapshots);
