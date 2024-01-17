import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";
import { assert } from "@jsenv/assert";

await startSnapshotTesting("bigint", {
  basic: () => {
    assert({
      actual: BigInt(1),
      expected: BigInt(1),
    });
  },
  fail_bigint: () => {
    assert({
      actual: BigInt(1),
      expected: BigInt(2),
    });
  },
});
