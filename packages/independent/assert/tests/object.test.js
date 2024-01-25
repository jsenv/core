import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("object", {
  ["false should be an object"]: () => {
    assert({
      actual: false,
      expected: { foo: true },
    });
  },
  ["two properties are different"]: () => {
    assert({
      actual: { a: true, b: true },
      expected: { a: false, b: false },
    });
  },
  ["false should be an object at property"]: () => {
    assert({
      actual: {
        foo: false,
      },
      expected: {
        foo: { a: true },
      },
    });
  },
  ["object should be false at property"]: () => {
    assert({
      actual: {
        foo: { a: true },
      },
      expected: {
        foo: false,
      },
    });
  },
  ["object should be false at deep property truncated"]: () => {
    assert({
      actual: {
        the: {
          nesting: {
            is: {},
          },
        },
        toto: "actual",
      },
      expected: false,
      maxDepth: 0,
    });
  },
  ["object should be false at deep property"]: () => {
    assert({
      actual: {
        the: {
          nesting: {
            is: {
              very: {
                deep: {
                  in: {
                    this: {
                      one: {
                        foo: {
                          a: true,
                          toto: { test: true, bar: { a: "1" } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        toto: "actual",
      },
      expected: {
        the: {
          nesting: {
            is: {
              very: {
                deep: {
                  in: {
                    this: {
                      one: {
                        foo: false,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        toto: "expected",
      },
      maxDepth: 5,
    });
  },
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
