import { takeDirectorySnapshot } from "@jsenv/snapshots";

const sourceDirectoryUrl = new URL("./source/", import.meta.url);
const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);

takeDirectorySnapshot(sourceDirectoryUrl, snapshotsDirectoryUrl);
