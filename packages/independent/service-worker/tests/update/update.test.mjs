import { compareSnapshotTakenByFunction } from "@jsenv/snapshot";

// https certificate not trusted on CI, see https://github.com/jsenv/https-local/issues/9
if (!process.env.CI) {
  compareSnapshotTakenByFunction(
    new URL("./snapshots/html/", import.meta.url),
    async () => {
      process.env.FROM_TESTS = "true";
      await import("./update_snapshots.mjs");
    },
  );
}
