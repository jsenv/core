import { writeFileSync, ensureEmptyDirectorySync } from "@jsenv/filesystem";

export const saveDirectorySnapshot = (
  directorySnapshot,
  snapshotDirectoryUrl,
) => {
  ensureEmptyDirectorySync(snapshotDirectoryUrl);
  Object.keys(directorySnapshot).forEach((relativeUrl) => {
    const contentUrl = new URL(relativeUrl, snapshotDirectoryUrl);
    const content = directorySnapshot[relativeUrl];
    writeFileSync(contentUrl, content);
  });
};

export const saveFileSnapshot = (fileSnapshot, snapshotFileUrl) => {
  writeFileSync(snapshotFileUrl, fileSnapshot);
};
