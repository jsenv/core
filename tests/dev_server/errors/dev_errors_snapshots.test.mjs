import { compareSnapshotTakenByFunction } from "@jsenv/snapshot";

// disable on windows because it would fails due to line endings (CRLF)
if (process.platform !== "win32") {
  compareSnapshotTakenByFunction(
    new URL("./snapshots/", import.meta.url),
    async () => {
      process.env.FROM_TESTS = "true";
      await import("./generate_snapshot_files.mjs");
    },
  );
}
