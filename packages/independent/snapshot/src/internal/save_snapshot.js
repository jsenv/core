import { writeFileSync, ensureEmptyDirectorySync } from "@jsenv/filesystem";

export const saveSnapshotOnFileSystem = (snapshot, snapshotUrl) => {
  if (typeof snapshot === "string" || Buffer.isBuffer(snapshot)) {
    writeFileSync(snapshotUrl, snapshot);
    return;
  }

  ensureEmptyDirectorySync(snapshotUrl);
  Object.keys(snapshot).forEach((relativeUrl) => {
    const entryUrl = new URL(relativeUrl, snapshotUrl);
    const entrySnapshot = snapshot[relativeUrl];
    saveSnapshotOnFileSystem(entrySnapshot, entryUrl);
  });
};
