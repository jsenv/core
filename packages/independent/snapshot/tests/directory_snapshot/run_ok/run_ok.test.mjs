import { takeDirectorySnapshot } from "@jsenv/snapshot";

const sourceDirectoryUrl = new URL("./source/", import.meta.url);
const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);

takeDirectorySnapshot(sourceDirectoryUrl, snapshotsDirectoryUrl);
