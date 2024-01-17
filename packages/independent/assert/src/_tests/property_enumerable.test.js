import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";
import { assert } from "@jsenv/assert";

await startSnapshotTesting("property_enumerable", {
  both_enumerable: () => {
    assert({
      actual: Object.defineProperty({}, "foo", { enumerable: true }),
      expected: Object.defineProperty({}, "foo", { enumerable: true }),
    });
  },
  fail_should_be_enumerable: () => {
    assert({
      actual: Object.defineProperty({}, "foo", { enumerable: false }),
      expected: Object.defineProperty({}, "foo", { enumerable: true }),
    });
  },
  fail_should_not_be_enumerable: () => {
    assert({
      actual: Object.defineProperty({}, "foo", { enumerable: true }),
      expected: Object.defineProperty({}, "foo", { enumerable: false }),
    });
  },
});
