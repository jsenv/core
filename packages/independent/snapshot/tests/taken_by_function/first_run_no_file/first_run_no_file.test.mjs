import { assert } from "@jsenv/assert";

import { compareSnapshotTakenByFunction } from "@jsenv/snapshot";

const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);

try {
  await compareSnapshotTakenByFunction(snapshotsDirectoryUrl, () => {});
  throw new Error("should throw");
} catch (e) {
  const actual = e.message;
  const expected = `function was expected to write file at ${snapshotsDirectoryUrl}`;
  assert({ actual, expected });
}
