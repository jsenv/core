import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();
// class Signal {
//   constructor(value) {
//     this.value = value;
//   }
//   valueOf() {
//     return this.value;
//   }
// }
// const signal = (v) => new Signal(v);

await startSnapshotTesting("internal_value", {
  // ["signal string"]: () => {
  //   assert({
  //     actual: {
  //       [Symbol.toStringTag]: "Signal",
  //       valueOf: () => "a",
  //     },
  //     expected: {
  //       [Symbol.toStringTag]: "Signal",
  //       valueOf: () => "b",
  //     },
  //   });
  // },
  ["signal boolean and boolean"]: () => {
    assert({
      actual: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => true,
      },
      expected: true,
    });
  },
  // ["boolean and signal boolean"]: () => {
  //   assert({
  //     actual: true,
  //     expected: {
  //       [Symbol.toStringTag]: "Signal",
  //       valueOf: () => true,
  //     },
  //   });
  // },
  // ["signal string and string"]: () => {
  //   assert({
  //     actual: {
  //       [Symbol.toStringTag]: "Signal",
  //       valueOf: () => "a",
  //     },
  //     expected: "ab",
  //   });
  // },
  // ["signal array"]: () => {
  //   assert({
  //     actual: {
  //       [Symbol.toStringTag]: "Signal",
  //       valueOf: () => ["a"],
  //     },
  //     expected: {
  //       [Symbol.toStringTag]: "Signal",
  //       valueOf: () => ["b"],
  //     },
  //   });
  // },
  // ["valueOf not displayed when return object itself"]: () => {
  //   const actual = { a: true, valueOf: () => actual };
  //   const expected = { a: false, valueOf: () => expected };
  //   assert({
  //     actual,
  //     expected,
  //   });
  // },
  // ["valueOf returns something diff"]: () => {
  //   const actual = { valueOf: () => actual };
  //   const expected = { valueOf: () => "10" };
  //   assert({
  //     actual,
  //     expected,
  //   });
  // },
});
