import { readSnapshotsFromDirectory, assertSnapshots } from "@jsenv/snapshots";

// https certificate not trusted on CI, see https://github.com/jsenv/https-local/issues/9
if (!process.env.CI) {
  const snapshotsHtmlDirectoryUrl = new URL(
    "./snapshots/html/",
    import.meta.url,
  );
  const actual = readSnapshotsFromDirectory(snapshotsHtmlDirectoryUrl);
  process.env.FROM_TESTS = "true";
  await import("./update_snapshots.mjs");
  const expected = readSnapshotsFromDirectory(snapshotsHtmlDirectoryUrl);
  assertSnapshots({ actual, expected });
}
