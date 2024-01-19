import stripAnsi from "strip-ansi";
import { takeFileSnapshot } from "@jsenv/snapshot";

import { writeFileSync } from "@jsenv/filesystem";

export const startSnapshotTesting = async (name, scenarios) => {
  let fileContent = "";
  const snapshotFileUrl = new URL(`../snapshots/${name}.txt`, import.meta.url);
  const fileSnapshot = takeFileSnapshot(snapshotFileUrl);
  for (const key of Object.keys(scenarios)) {
    try {
      await scenarios[key]();
    } catch (e) {
      fileContent += `# ${key}\n`;
      fileContent += `${e.name}: ${stripAnsi(e.message)}\n\n`;
    }
  }
  writeFileSync(snapshotFileUrl, fileContent);
  fileSnapshot.compare();
};
