/* eslint-disable no-sparse-arrays */
import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./start_snapshot_testing.js";

await startSnapshotTesting("array", {
  ["array first item diff"]: () => {
    assert({
      actual: [true],
      expect: [false],
    });
  },
  ["array expect, object received"]: () => {
    assert({
      actual: {},
      expect: [],
    });
  },
  // ["diff in the middle of big array"]: () => {
  //   assert({
  //     actual: ["a", "b", "c", "Z", "e", "f", "g", "h"],
  //     expect: ["a", "b", "c", "d", "e", "f", "g", "h"],
  //   });
  // },
  // ["big array collapsed because diff is elsewhere"]: () => {
  //   assert({
  //     actual: {
  //       a: ["a", "b", "c", "d", "e", "f", "g", "h"],
  //       b: true,
  //     },
  //     expect: {
  //       a: ["a", "b", "c", "d", "e", "f", "g", "h"],
  //       b: false,
  //     },
  //     maxColumns: 35,
  //   });
  // },
  // ["undefined vs empty"]: () => {
  //   assert({
  //     actual: [,],
  //     expect: [undefined],
  //   });
  // },
  // ["empty added"]: () => {
  //   assert({
  //     actual: [,],
  //     expect: [],
  //   });
  // },
  // ["empty removed"]: () => {
  //   assert({
  //     actual: [],
  //     expect: [,],
  //   });
  // },
  // ["object expect, array received"]: () => {
  //   assert({
  //     actual: [],
  //     expect: {},
  //   });
  // },
  // ["false should be an array"]: () => {
  //   assert({
  //     actual: false,
  //     expect: [],
  //   });
  // },
  // ["associative array expect, object received"]: () => {
  //   assert({
  //     actual: Object.assign([], {
  //       foo: true,
  //     }),
  //     expect: {
  //       foo: true,
  //     },
  //   });
  // },
  // ["diff on associate array.foo and object.foo"]: () => {
  //   assert({
  //     actual: Object.assign([], {
  //       foo: true,
  //     }),
  //     expect: {
  //       foo: false,
  //     },
  //   });
  // },
  // ["diff on associate array deep property and object deep property"]: () => {
  //   assert({
  //     actual: Object.assign([], {
  //       user: { name: "bob" },
  //     }),
  //     expect: {
  //       user: {
  //         name: "alice",
  //       },
  //     },
  //   });
  // },
  // ["diff on collapsed array"]: () => {
  //   assert({
  //     actual: {
  //       a: {
  //         same: [true],
  //         a: [false, false],
  //         r: [],
  //         ma: [false, true],
  //         mr: [false],
  //         m: [false, false],
  //       },
  //     },
  //     expect: {
  //       a: {
  //         same: [true],
  //         a: [],
  //         r: [true, true, true],
  //         ma: [true],
  //         mr: [true],
  //         m: [true, true],
  //       },
  //     },
  //     maxDepthInsideDiff: 0,
  //   });
  // },
  // ["string and array of chars"]: () => {
  //   assert({
  //     actual: "hello world",
  //     expect: ["h", "e", "l", "l", "o", " ", "w", "o", "r", "l", "d"],
  //   });
  // },
  // ["associative array with values"]: () => {
  //   assert({
  //     actual: Object.assign(["a", "b"], {
  //       user: "bob",
  //     }),
  //     expect: Object.assign(["Z", "b"], {
  //       user: "alice",
  //     }),
  //   });
  // },
  // ["array like and array"]: () => {
  //   assert({
  //     actual: {
  //       0: "Z",
  //       1: "b",
  //       length: 2,
  //     },
  //     expect: [
  //       "a", //
  //       "b",
  //     ],
  //   });
  // },
  // ["array subclass"]: () => {
  //   class MyArray extends Array {}
  //   assert({
  //     colors: false,
  //     actual: [true],
  //     expect: new MyArray(true),
  //   });
  // },
});
