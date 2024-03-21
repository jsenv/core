import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("object", {
  // ["property are different"]: () => {
  //   assert({
  //     actual: {
  //       a: true,
  //     },
  //     expected: {
  //       a: false,
  //     },
  //   });
  // },
  // ["property should be there"]: () => {
  //   assert({
  //     actual: {
  //       a: true,
  //     },
  //     expected: {
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
  //     expected: {
  //       a: true,
  //     },
  //   });
  // },
  // ["false should be an object"]: () => {
  //   assert({
  //     actual: false,
  //     expected: { foo: true },
  //   });
  // },
  // ["false should be an object at property"]: () => {
  //   assert({
  //     actual: {
  //       foo: false,
  //     },
  //     expected: {
  //       foo: { a: true },
  //     },
  //   });
  // },
  // ["object should be false at property"]: () => {
  //   assert({
  //     actual: {
  //       foo: { a: true },
  //     },
  //     expected: {
  //       foo: false,
  //     },
  //   });
  // },
  // ["object should be false at deep property truncated"]: () => {
  //   assert({
  //     actual: {
  //       the: {
  //         nesting: {
  //           is: {},
  //         },
  //       },
  //       toto: "actual",
  //     },
  //     expected: false,
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
  //                         toto: { test: true, bar: { a: "1" } },
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
  //     expected: {
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
  //       toto: "expected",
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
  //     expected: {
  //       foo: {
  //         a: true,
  //       },
  //     },
  //     maxDepth: 5,
  //   });
  // },
  // ["collapsed when no diff"]: () => {
  //   assert({
  //     actual: {
  //       a: { foo: true, bar: true, baz: { t: 1 } },
  //       b: true,
  //     },
  //     expected: {
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
  //     expected: {
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
  //     expected: {
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
  //     expected: {
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
  //     expected: {
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
  //     expected: {
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
  //     expected: {
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
  //     expected: {
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
  //     expected: {
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
  //     expected: {
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
  //     expected: {
  //       a: true,
  //       b: false,
  //     },
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
