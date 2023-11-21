import {
  assertSnapshotDirectoryTakenByFunction,
  writeDirectoryContent,
} from "@jsenv/snapshots";

const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);

await assertSnapshotDirectoryTakenByFunction(snapshotsDirectoryUrl, () => {
  writeDirectoryContent(snapshotsDirectoryUrl, {
    "a.js": `console.log("a");\n`,
  });
});
