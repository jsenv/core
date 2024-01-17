import stripAnsi from "strip-ansi";
import { takeDirectorySnapshot } from "@jsenv/snapshot";

import { writeFileSync } from "@jsenv/filesystem";

export const startSnapshotTesting = (name) => {
  let number = 0;
  const snapshotDirectoryUrl = new URL(`./snapshots/${name}/`, import.meta.url);
  const directorySnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  const writeError = (error, filename) => {
    number++;
    const snapshotFileUrl = new URL(
      `${number}_${filename}.txt`,
      snapshotDirectoryUrl,
    );
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
