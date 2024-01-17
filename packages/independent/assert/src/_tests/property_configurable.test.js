import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";
import { assert } from "@jsenv/assert";

await startSnapshotTesting("property_configurable", {
  both_configurable: () => {
    assert({
      actual: Object.defineProperty({}, "foo", { configurable: true }),
      expected: Object.defineProperty({}, "foo", { configurable: true }),
    });
  },
  fail_should_be_configurable: () => {
    assert({
      actual: Object.defineProperty({}, "foo", { configurable: false }),
      expected: Object.defineProperty({}, "foo", { configurable: true }),
    });
  },
  fail_should_not_be_configurable: () => {
    assert({
      actual: Object.defineProperty({}, "foo", { configurable: true }),
      expected: Object.defineProperty({}, "foo", { configurable: false }),
    });
  },
});
