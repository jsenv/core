import { assertSnapshotDirectoryTakenByFunction } from "@jsenv/snapshots";

assertSnapshotDirectoryTakenByFunction(
  new URL("./snapshots/", import.meta.url),
  async () => {
    await import("./execution_logs_snapshots.mjs");
  },
);
