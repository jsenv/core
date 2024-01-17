/* eslint-disable accessor-pairs */
import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";
import { assert } from "@jsenv/assert";

await startSnapshotTesting("property_set", {
  same_setters: () => {
    assert({
      actual: Object.defineProperty({}, "foo", { set: () => {} }),
      expected: Object.defineProperty({}, "foo", { set: () => {} }),
    });
  },
  fail_should_have_property_setter: () => {
    assert({
      actual: Object.defineProperty({}, "foo", {}),
      expected: Object.defineProperty({}, "foo", { set: () => {} }),
    });
  },
  fail_should_not_have_property_setter: () => {
    assert({
      actual: Object.defineProperty({}, "foo", { set: () => {} }),
      expected: Object.defineProperty({}, "foo", {}),
    });
  },
  fail_property_setter_name: () => {
    const actualSetter = () => 1;
    const expectedSetter = () => 1;
    assert({
      actual: Object.defineProperty({}, "foo", { set: actualSetter }),
      expected: Object.defineProperty({}, "foo", { set: expectedSetter }),
    });
  },
});
