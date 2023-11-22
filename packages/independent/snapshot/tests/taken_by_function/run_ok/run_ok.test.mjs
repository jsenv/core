import {
  compareSnapshotTakenByFunction,
  saveDirectorySnapshot,
} from "@jsenv/snapshot";

const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);

await compareSnapshotTakenByFunction(snapshotsDirectoryUrl, () => {
  saveDirectorySnapshot(snapshotsDirectoryUrl, {
    "a.js": `console.log("a");\n`,
  });
});
