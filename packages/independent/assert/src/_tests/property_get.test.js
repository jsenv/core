import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";
import { assert } from "@jsenv/assert";

await startSnapshotTesting("property_get", {
  same_getters: () => {
    assert({
      actual: Object.defineProperty({}, "foo", { get: () => 1 }),
      expected: Object.defineProperty({}, "foo", { get: () => 1 }),
    });
  },
  fail_should_have_property_getter: () => {
    assert({
      actual: Object.defineProperty({}, "foo", {}),
      expected: Object.defineProperty({}, "foo", { get: () => 1 }),
    });
  },
  fail_should_not_have_property_getter: () => {
    assert({
      actual: Object.defineProperty({}, "foo", { get: () => 1 }),
      expected: Object.defineProperty({}, "foo", {}),
    });
  },
  fail_property_getter_name: () => {
    const actualGetter = () => 1;
    const expectedGetter = () => 1;
    assert({
      actual: Object.defineProperty({}, "foo", { get: actualGetter }),
      expected: Object.defineProperty({}, "foo", { get: expectedGetter }),
    });
  },
});
