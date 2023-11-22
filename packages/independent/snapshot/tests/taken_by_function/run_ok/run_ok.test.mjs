import {
  compareSnapshotTakenByFunction,
  saveSnapshotOnFileSystem,
} from "@jsenv/snapshot";

const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);

await compareSnapshotTakenByFunction(snapshotsDirectoryUrl, () => {
  saveSnapshotOnFileSystem(
    {
      "a.js": `console.log("a");\n`,
    },
    snapshotsDirectoryUrl,
  );
});
