import { assert } from "@jsenv/assert";

import { assertSnapshotDirectoryTakenByFunction } from "@jsenv/snapshot";

const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);

try {
  await assertSnapshotDirectoryTakenByFunction(snapshotsDirectoryUrl, () => {});
  throw new Error("should throw");
} catch (e) {
  const actual = e.message;
  const expected = `function was expected to write file(s) in ${snapshotsDirectoryUrl}`;
  assert({ actual, expected });
}
