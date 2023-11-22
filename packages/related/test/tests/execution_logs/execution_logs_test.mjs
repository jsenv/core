import { compareSnapshotTakenByFunction } from "@jsenv/snapshot";

compareSnapshotTakenByFunction(
  new URL("./snapshots/", import.meta.url),
  async () => {
    await import("./execution_logs_snapshots.mjs");
  },
);
