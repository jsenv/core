import { startSnapshotTesting } from "./start_snapshot_testing.js";
import { executeInNewContext } from "../executeInNewContext.js";
import { assert } from "@jsenv/assert";

await startSnapshotTesting("prototype", {
  same_object_prototypes: () => {
    assert({ actual: {}, expected: {} });
  },
  same_prototype_cross_realm: async () => {
    assert({
      actual: await executeInNewContext("[]"),
      expected: [],
    });
  },
  fail_direct_prototype: () => {
    const ancestorPrototype = { ancestor: true };
    const directPrototype = Object.create(ancestorPrototype);
    directPrototype.direct = true;
    assert({
      actual: Object.create(ancestorPrototype),
      expected: Object.create(directPrototype),
    });
  },
  fail_ancestor_prototype: () => {
    const ancestorAPrototype = { ancestorA: true };
    const ancestorBPrototype = { ancestorB: true };
    const childAPrototype = Object.create(ancestorAPrototype);
    childAPrototype.parentA = true;
    const childBPrototype = Object.create(ancestorBPrototype);
    childBPrototype.parentB = true;
    assert({
      actual: Object.create(childAPrototype),
      expected: Object.create(childBPrototype),
    });
  },
  fail_prototype_should_be_null: () => {
    assert({
      actual: {},
      expected: Object.create(null),
    });
  },
  fail_prototype_should_not_be_null: () => {
    assert({
      actual: { value: Object.create(null) },
      expected: { value: {} },
    });
  },
  fail_prototype_should_be_actual_itself: () => {
    const prototype = {};
    assert({
      actual: prototype,
      expected: Object.create(prototype),
    });
  },
  fail_prototype_should_be_expected_itself: () => {
    const prototype = {};
    assert({
      actual: Object.create(prototype),
      expected: prototype,
    });
  },
});
