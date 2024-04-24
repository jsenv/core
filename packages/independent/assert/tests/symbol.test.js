import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

// TODO:
// - symbol diff are displayed first
// - symbol not displayed when no diff (because they are usually internal)

await startSnapshotTesting("symbol", {
  // ["named Symbol() property added"]: () => {
  //   assert({
  //     actual: {
  //       [Symbol("foo")]: true,
  //     },
  //     expect: {},
  //   });
  // },
  // ["named Symbol() property removed"]: () => {
  //   assert({
  //     actual: {},
  //     expect: {
  //       [Symbol("foo")]: true,
  //     },
  //   });
  // },
  // ["named Symbol() property value modified"]: () => {
  //   assert({
  //     actual: {
  //       [Symbol("foo")]: true,
  //     },
  //     expect: {
  //       [Symbol("foo")]: false,
  //     },
  //   });
  // },
  // ["named Symbol() property no diff"]: () => {
  //   assert({
  //     actual: {
  //       a: true,
  //       [Symbol("foo")]: true,
  //     },
  //     expect: {
  //       a: false,
  //       [Symbol("foo")]: true,
  //     },
  //   });
  // },
  // ["anonymous Symbol() property value modified"]: () => {
  //   assert({
  //     actual: {
  //       [Symbol()]: true,
  //     },
  //     expect: {
  //       [Symbol()]: false,
  //     },
  //   });
  // },
  // ["Symbol.for() property value modified"]: () => {
  //   assert({
  //     actual: {
  //       [Symbol.for("foo")]: true,
  //     },
  //     expect: {
  //       [Symbol.for("foo")]: false,
  //     },
  //   });
  // },
  // ["Symbol.iterator property value modified"]: () => {
  //   assert({
  //     actual: {
  //       [Symbol.iterator]: true,
  //     },
  //     expect: {
  //       [Symbol.iterator]: false,
  //     },
  //   });
  // },
  // ["Symbol.toStringTag property value modified"]: () => {
  //   assert({
  //     actual: {
  //       [Symbol.toStringTag]: "a",
  //     },
  //     expect: {
  //       [Symbol.toStringTag]: "b",
  //     },
  //   });
  // },
  ["well known symbol diff"]: () => {
    assert({
      actual: Symbol.iterator,
      expect: Symbol.toStringTag,
    });
  },
  ["Symbol() description modified"]: () => {
    assert({
      actual: Symbol("a"),
      expect: Symbol("b"),
    });
  },
  ["Symbol.for() key modified"]: () => {
    assert({
      actual: Symbol.for("a"),
      expect: Symbol.for("b"),
    });
  },
  ["named Symbol() vs anonymous symbol"]: () => {
    assert({
      actual: Symbol("a"),
      expect: Symbol(),
    });
  },
  ["anonymous symbol vs named Symbol()"]: () => {
    assert({
      actual: Symbol(""),
      expect: Symbol("b"),
    });
  },
  ["named Symbol() vs Symbol.for()"]: () => {
    assert({
      actual: Symbol("a"),
      expect: Symbol.for("a"),
    });
  },
  ["Symbol.for() vs named Symbol()"]: () => {
    assert({
      actual: Symbol.for("b"),
      expect: Symbol("a"),
    });
  },
});
