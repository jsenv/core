import { startSnapshotTesting } from "./start_snapshot_testing.js";
import { assert } from "@jsenv/assert";

await startSnapshotTesting("property_writable", {
  both_writable: () => {
    assert({
      actual: Object.defineProperty({}, "foo", { writable: true }),
      expected: Object.defineProperty({}, "foo", { writable: true }),
    });
  },
  fail_should_be_writable: () => {
    assert({
      actual: Object.defineProperty({}, "foo", { writable: false }),
      expected: Object.defineProperty({}, "foo", { writable: true }),
    });
  },
  fail_should_not_be_writable: () => {
    assert({
      actual: Object.defineProperty({}, "foo", { writable: true }),
      expected: Object.defineProperty({}, "foo", { writable: false }),
    });
  },
});
