import { startSnapshotTesting } from "./start_snapshot_testing.js";
import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("object", {
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
  // ["false should be an object at property"]: () => {
  //   assert({
  //     actual: {
  //       foo: false,
  //     },
  //     expect: {
  //       foo: { a: true },
  //     },
  //   });
  // },
  // ["object should be false at property"]: () => {
  //   assert({
  //     actual: {
  //       foo: { a: true },
  //     },
  //     expect: {
  //       foo: false,
  //     },
  //   });
  // },
  // ["object should be false at deep property truncated"]: () => {
  //   assert({
  //     actual: {
  //       the: { nesting: { is: {} } },
  //       toto: "actual",
  //     },
  //     expect: false,
  //     maxDepth: 0,
  //   });
  // },
  // ["object should be false at deep property"]: () => {
  //   assert({
  //     actual: {
  //       the: {
  //         nesting: {
  //           is: {
  //             very: {
  //               deep: {
  //                 in: {
  //                   this: {
  //                     one: {
  //                       foo: {
  //                         a: true,
  //                         tata: { test: true, bar: { a: "1" } },
  //                       },
  //                     },
  //                   },
  //                 },
  //               },
  //             },
  //           },
  //         },
  //       },
  //       toto: "actual",
  //     },
  //     expect: {
  //       the: {
  //         nesting: {
  //           is: {
  //             very: {
  //               deep: {
  //                 in: {
  //                   this: {
  //                     one: {
  //                       foo: false,
  //                     },
  //                   },
  //                 },
  //               },
  //             },
  //           },
  //         },
  //       },
  //       toto: "expect",
  //     },
  //     maxDepth: 5,
  //   });
  // },
  // ["maxDepth on diff"]: () => {
  //   assert({
  //     actual: {
  //       foo: {
  //         a: { b: { c: { d: { e: { f: {} } } } } },
  //       },
  //     },
  //     expect: {
  //       foo: {
  //         a: true,
  //       },
  //     },
  //     maxDepth: 5,
  //   });
  // },
  // ["collapsed with overview when no diff"]: () => {
  //   assert({
  //     actual: {
  //       a: { foo: true, bar: true, baz: { t: 1 } },
  //       b: true,
  //     },
  //     expect: {
  //       a: { foo: true, bar: true, baz: { t: 1 } },
  //       b: false,
  //     },
  //   });
  // },
  // ["max 2 props above prop diff"]: () => {
  //   assert({
  //     actual: {
  //       a: true,
  //       b: true,
  //       c: true,
  //       d: true,
  //     },
  //     expect: {
  //       a: true,
  //       b: true,
  //       c: true,
  //       d: false,
  //     },
  //   });
  // },
  // ["max 2 props above prop diff and there is exactly 2"]: () => {
  //   assert({
  //     actual: {
  //       a: true,
  //       b: true,
  //       c: true,
  //       d: true,
  //     },
  //     expect: {
  //       a: true,
  //       b: true,
  //       c: false,
  //       d: true,
  //     },
  //   });
  // },
  // ["max 2 props after prop diff"]: () => {
  //   assert({
  //     actual: {
  //       a: true,
  //       b: true,
  //       c: true,
  //       d: true,
  //     },
  //     expect: {
  //       a: false,
  //       b: true,
  //       c: true,
  //       d: true,
  //     },
  //   });
  // },
  // ["max 2 props above after diff and there is exactly 2"]: () => {
  //   assert({
  //     actual: {
  //       a: true,
  //       b: true,
  //       c: true,
  //       d: true,
  //     },
  //     expect: {
  //       a: true,
  //       b: false,
  //       c: true,
  //       d: true,
  //     },
  //   });
  // },
  // ["max 2 props around prop diff"]: () => {
  //   assert({
  //     actual: {
  //       a: true,
  //       b: true,
  //       c: true,
  //       d: true,
  //       e: true,
  //       f: true,
  //       g: true,
  //       h: true,
  //       i: true,
  //       j: true,
  //       k: true,
  //       l: true,
  //       m: true,
  //       n: true,
  //       o: true,
  //     },
  //     expect: {
  //       a: true,
  //       b: true,
  //       c: true,
  //       d: false,
  //       e: true,
  //       f: true,
  //       g: true,
  //       h: false,
  //       i: true,
  //       j: true,
  //       k: true,
  //       l: false,
  //       m: true,
  //       n: true,
  //       o: true,
  //     },
  //   });
  // },
  // ["max X diff per object"]: () => {
  //   assert({
  //     actual: {
  //       a: true,
  //       b: true,
  //       c: true,
  //     },
  //     expect: {
  //       a: false,
  //       b: false,
  //       c: false,
  //     },
  //     maxDiffPerObject: 2,
  //   });
  // },
  // ["property should be there and is big"]: () => {
  //   assert({
  //     actual: {
  //       a: true,
  //     },
  //     expect: {
  //       a: true,
  //       should_be_there: {
  //         a: true,
  //         b: true,
  //         item: { a: 1, b: 1, c: 1 },
  //         c: true,
  //         d: true,
  //         e: true,
  //         f: true,
  //         g: true,
  //       },
  //     },
  //     maxColumns: 100,
  //   });
  // },
  // ["many props should not be there"]: () => {
  //   assert({
  //     actual: {
  //       a: true,
  //       b: true,
  //       c: { an_object: true, and: true },
  //       d: true,
  //       e: true,
  //       f: true,
  //       g: true,
  //       h: true,
  //     },
  //     expect: {
  //       a: true,
  //       c: {},
  //     },
  //   });
  // },
  // ["max prop in diff"]: () => {
  //   assert({
  //     actual: {
  //       foo: {
  //         a: true,
  //         b: true,
  //         c: true,
  //         d: true,
  //         e: true,
  //       },
  //     },
  //     expect: {
  //       foo: false,
  //     },
  //     maxValueInsideDiff: 2,
  //   });
  // },
  // ["props order"]: () => {
  //   assert({
  //     actual: {
  //       b: true,
  //       a: false,
  //     },
  //     expect: {
  //       a: true,
  //       b: false,
  //     },
  //   });
  // },
  // ["property key truncated"]: () => {
  //   assert({
  //     actual: {
  //       "a quite long property key that will be truncated": true,
  //     },
  //     expect: {
  //       "a quite long property key that will be truncated": false,
  //     },
  //     maxColumns: 40,
  //   });
  // },
  // ["property key multiline"]: () => {
  //   assert({
  //     actual: {
  //       "first\nsecond that is quite long": true,
  //     },
  //     expect: {
  //       "first\nsecond that is quite long": false,
  //     },
  //     maxColumns: 30,
  //   });
  // },
  // ["nested object becomes false"]: () => {
  //   assert({
  //     actual: false,
  //     expect: {
  //       a: true,
  //       b: { toto: true },
  //       c: true,
  //     },
  //   });
  // },
  // ["osc becomes dam at property value nested"]: () => {
  //   assert({
  //     actual: {
  //       user: { name: "dam" },
  //     },
  //     expect: {
  //       user: { name: "osc" },
  //     },
  //   });
  // },
});
