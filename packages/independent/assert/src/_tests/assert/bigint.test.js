import { startSnapshotTesting } from "./start_snapshot_testing.js";
import { assert } from "@jsenv/assert";

const bigintSnapshotTesting = startSnapshotTesting("bigint");

assert({
  actual: BigInt(1),
  expected: BigInt(1),
});

try {
  assert({
    actual: BigInt(1),
    expected: BigInt(2),
  });
} catch (error) {
  bigintSnapshotTesting.writeError(error, "bigint_fail.txt");
}
