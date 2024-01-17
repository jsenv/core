import stripAnsi from "strip-ansi";
import { takeDirectorySnapshot } from "@jsenv/snapshot";

import { writeFileSync } from "@jsenv/filesystem";

export const startSnapshotTesting = async (name, scenarios) => {
  let number = 0;
  const snapshotDirectoryUrl = new URL(
    `../snapshots/${name}/`,
    import.meta.url,
  );
  const directorySnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  for (const key of Object.keys(scenarios)) {
    try {
      await scenarios[key]();
    } catch (e) {
      number++;
      const snapshotFileUrl = new URL(
        `${number}_${key}.txt`,
        snapshotDirectoryUrl,
      );
      writeFileSync(snapshotFileUrl, `${e.name}: ${stripAnsi(e.message)}`);
    }
  }
  directorySnapshot.compare();
};
