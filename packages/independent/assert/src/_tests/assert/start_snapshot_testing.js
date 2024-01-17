import stripAnsi from "strip-ansi";
import { takeDirectorySnapshot } from "@jsenv/snapshot";

import { writeFileSync } from "@jsenv/filesystem";

export const startSnapshotTesting = (name) => {
  const snapshotDirectoryUrl = new URL(`./snapshots/${name}/`, import.meta.url);
  const directorySnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  const writeError = (error, filename) => {
    const snapshotFileUrl = new URL(filename, snapshotDirectoryUrl);
    writeFileSync(
      snapshotFileUrl,
      `${error.name}: ${stripAnsi(error.message)}`,
    );
  };
  return {
    writeError,
    end: () => {
      directorySnapshot.compare();
    },
  };
};
