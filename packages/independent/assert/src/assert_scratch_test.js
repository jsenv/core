import { startSnapshotTesting } from "../tests/start_snapshot_testing.js";
import { assert } from "./assert_scratch.js";

await startSnapshotTesting("assert_scratch", {
  ["maxDepth on diff"]: () => {
    assert({
      actual: {
        foo: { foo_a: { foo_a2: {} }, foo_b: { foo_b2: {} } },
        bar: true,
      },
      expect: {
        foo: { foo_a: { foo_a2: {} }, foo_b: { foo_b2: {} } },
        bar: { bar_a: { bar_a2: {} } },
      },
      MAX_DEPTH: 2,
      MAX_DEPTH_INSIDE_DIFF: 1,
    });
  },
  // ["property are different"]: () => {
  //   assert({
  //     actual: {
  //       a: true,
  //       b: {
  //         a: {
  //           y: true,
  //           z: true,
  //         },
  //       },
  //       c: true,
  //     },
  //     expect: {
  //       c: true,
  //       b: { a: false },
  //       a: true,
  //     },
  //   });
  // },
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
