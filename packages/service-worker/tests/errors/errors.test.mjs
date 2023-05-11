import {
  readSnapshotsFromDirectory,
  assertSnapshots,
} from "@jsenv/core/tests/snapshots_directory.js";

// https certificate only generated on linux
if (process.platform === "linux") {
  const snapshotsHtmlDirectoryUrl = new URL(
    "./snapshots/html/",
    import.meta.url,
  );
  const snapshotDirectoryContent = readSnapshotsFromDirectory(
    snapshotsHtmlDirectoryUrl,
  );
  process.env.FROM_TESTS = "true";
  await import("./errors_snapshots.mjs");
  const directoryContent = readSnapshotsFromDirectory(
    snapshotsHtmlDirectoryUrl,
  );
  assertSnapshots({ directoryContent, snapshotDirectoryContent });
}
