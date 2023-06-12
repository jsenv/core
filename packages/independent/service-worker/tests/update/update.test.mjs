import {
  readSnapshotsFromDirectory,
  assertSnapshots,
} from "@jsenv/core/tests/snapshots_directory.js";

// https certificate not trusted on CI, see https://github.com/jsenv/https-local/issues/9
if (!process.env.CI) {
  const snapshotsHtmlDirectoryUrl = new URL(
    "./snapshots/html/",
    import.meta.url,
  );
  const snapshotDirectoryContent = readSnapshotsFromDirectory(
    snapshotsHtmlDirectoryUrl,
  );
  process.env.FROM_TESTS = "true";
  await import("./update_snapshots.mjs");
  const directoryContent = readSnapshotsFromDirectory(
    snapshotsHtmlDirectoryUrl,
  );
  assertSnapshots({ directoryContent, snapshotDirectoryContent });
}
