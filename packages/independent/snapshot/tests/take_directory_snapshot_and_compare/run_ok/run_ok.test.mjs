import { takeDirectorySnapshotAndCompare } from "@jsenv/snapshot";

const sourceDirectoryUrl = new URL("./source/", import.meta.url);
const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);

takeDirectorySnapshotAndCompare(sourceDirectoryUrl, snapshotsDirectoryUrl);
