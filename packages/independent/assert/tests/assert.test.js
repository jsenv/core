import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("assert", {
  ref_twice_in_object_becomes_true: () => {
    const item = { id: "a" };
    assert({
      actual: true,
      expected: { foo: item, bar: item },
    });
  },
  // false_becomes_true: () => {
  //   assert({
  //     actual: true,
  //     expected: false,
  //   });
  // },
  // object_becomes_false: () => {
  //   assert({
  //     actual: false,
  //     expected: { foo: true },
  //   });
  // },
  // nested_object_becomes_false: () => {
  //   assert({
  //     actual: false,
  //     expected: { a: true, b: { toto: true }, c: true },
  //   });
  // },
  // false_becomes_true_at_solo_property_value: () => {
  //   assert({
  //     actual: { foo: true },
  //     expected: { foo: false },
  //   });
  // },
  // true_becomes_false_at_second_and_last_property_value: () => {
  //   assert({
  //     actual: { foo: true, bar: false },
  //     expected: { foo: true, bar: true },
  //   });
  // },
  // false_becomes_true_at_second_property_value: () => {
  //   assert({
  //     actual: { a: true, b: true, c: true },
  //     expected: { a: true, b: false, c: true },
  //   });
  // },
  // osc_becomes_dam_at_property_value_nested: () => {
  //   assert({
  //     actual: { user: { name: "dam" } },
  //     expected: { user: { name: "osc" } },
  //   });
  // },
});
