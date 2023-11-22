import { assertSnapshotDirectoryTakenByFunction } from "@jsenv/snapshot";

assertSnapshotDirectoryTakenByFunction(
  new URL("./snapshots/", import.meta.url),
  async () => {
    await import("./execution_logs_snapshots.mjs");
  },
);
