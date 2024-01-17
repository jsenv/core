import { startSnapshotTesting } from "./start_snapshot_testing.js";
import { assert } from "@jsenv/assert";

await startSnapshotTesting("boolean", {
  basic: () => {
    assert({
      actual: true,
      expected: true,
    });
  },
  boolean_objects: () => {
    assert({
      // eslint-disable-next-line no-new-wrappers
      actual: new Boolean(true),
      // eslint-disable-next-line no-new-wrappers
      expected: new Boolean(true),
    });
  },
  fail_boolean: () => {
    assert({
      actual: true,
      expected: false,
    });
  },
  fail_boolean_objects: () => {
    assert({
      // eslint-disable-next-line no-new-wrappers
      actual: new Boolean(true),
      // eslint-disable-next-line no-new-wrappers
      expected: new Boolean(false),
    });
  },
  fail_0_and_false: () => {
    assert({
      actual: 0,
      expected: false,
    });
  },
  fail_1_and_true: () => {
    assert({
      actual: 1,
      expected: true,
    });
  },
});
