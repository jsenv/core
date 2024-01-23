import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("assert", {
  //   false_becomes_true: () => {
  //     assert({
  //       actual: true,
  //       expected: false,
  //     });
  //   },
  object_becomes_false: () => {
    assert({
      actual: false,
      expected: { foo: true },
    });
  },
  // diff_solo_property_value: () => {
  //   assert({
  //     actual: { foo: true },
  //     expected: { foo: false },
  //   });
  // },
  //   diff_second_and_last_property_value: () => {
  //     assert({
  //       actual: { foo: true, bar: false },
  //       expected: { foo: true, bar: true },
  //     });
  //   },
  //   diff_second_property_value: () => {
  //     assert({
  //       actual: { a: true, b: true, c: true },
  //       expected: { a: true, b: false, c: true },
  //     });
  //   },
  // diff_property_value_nested: () => {
  //   assert({
  //     actual: { user: { name: "dam" } },
  //     expected: { user: { name: "osc" } },
  //   });
  // },
});
