import { takeDirectorySnapshot, compareSnapshots } from "@jsenv/snapshot";

const snapshotDirectoryUrl = new URL("./snapshots/", import.meta.url);
const expectedSnapshots = takeDirectorySnapshot(snapshotDirectoryUrl);
await import("./execution_logs_snapshots.mjs");
const actualSnapshots = takeDirectorySnapshot(snapshotDirectoryUrl);
compareSnapshots(actualSnapshots, expectedSnapshots);
