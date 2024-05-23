import { startSnapshotTesting } from "../tests/start_snapshot_testing.js";
import { assert } from "./assert_scratch.js";

await startSnapshotTesting("assert_scratch", {
  ["property are different"]: () => {
    assert({
      actual: {
        a: true,
      },
      expect: {
        a: {
          b: true,
        },
      },
    });
  },
  ["max depth inside diff"]: () => {
    assert({
      actual: {
        foo: {
          foo_a: { foo_a2: { foo_a3: {} } },
          foo_b: { foo_b2: { foo_b3: {} } },
        },
        bar: true,
      },
      expect: {
        foo: {
          foo_a: { foo_a2: { foo_a3: {} } },
          foo_b: { foo_b2: { foo_b3: {} } },
        },
        bar: { bar_a: { bar_a2: {} } },
      },
      MAX_DEPTH: 2,
      MAX_DEPTH_INSIDE_DIFF: 1,
    });
  },
  ["max diff per object"]: () => {
    assert({
      actual: {
        a: true,
        b: {
          a: {
            y: true,
            z: true,
          },
        },
        c: true,
      },
      expect: {
        c: true,
        b: { a: false },
        a: true,
      },
      MAX_DIFF_PER_OBJECT: 2,
    });
  },
  ["max prop around diff"]: () => {
    assert({
      actual: {
        a: true,
        b: true,
        c: true,
      },
      expect: {
        c: true,
        b: false,
        a: true,
      },
      MAX_PROP_BEFORE_DIFF: 0,
      MAX_PROP_AFTER_DIFF: 0,
    });
  },
  ["property value truncated"]: () => {
    assert({
      actual: {
        foo: "abcdefghijk",
      },
      expect: {
        foo: "ABCDEFGHIJK",
      },
      MAX_COLUMNS: 20,
    });
  },
  ["property key truncated"]: () => {
    assert({
      actual: {
        "a quite long property key that will be truncated": true,
      },
      expect: {
        "a quite long property key that will be truncated": false,
      },
      MAX_COLUMNS: 40,
    });
  },
  // ["property are different"]: () => {
  //   assert({
  //     actual: {
  //       a: true,
  //     },
  //     expect: {
  //       a: {
  //         b: true,
  //       },
  //     },
  //   });
  // },
  // ["property order"]: () => {
  //   assert({
  //     actual: {
  //       a: "a",
  //       b: "b",
  //     },
  //     expect: {
  //       b: "b",
  //       a: "a",
  //     },
  //   });
  // },
  // ["property should be there"]: () => {
  //   assert({
  //     actual: {
  //       a: true,
  //     },
  //     expect: {
  //       a: true,
  //       should_be_there: true,
  //     },
  //   });
  // },
  // ["property should not be there"]: () => {
  //   assert({
  //     actual: {
  //       a: true,
  //       should_not_be_there: true,
  //     },
  //     expect: {
  //       a: true,
  //     },
  //   });
  // },
  // ["false should be an object"]: () => {
  //   assert({
  //     actual: false,
  //     expect: { foo: true },
  //   });
  // },
  // ["object should be false"]: () => {
  //   assert({
  //     actual: {
  //       foo: {
  //         a: {},
  //       },
  //     },
  //     expect: false,
  //   });
  // },
});
