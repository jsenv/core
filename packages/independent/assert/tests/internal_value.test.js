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
  ["signal(true) and signal(false)"]: () => {
    assert({
      actual: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => true,
      },
      expected: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => false,
      },
    });
  },
  ["signal(true) and true"]: () => {
    assert({
      actual: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => true,
      },
      expected: true,
    });
  },
  ["true and signal(true)"]: () => {
    assert({
      actual: true,
      expected: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => true,
      },
    });
  },
  ["true and signal(false)"]: () => {
    assert({
      actual: true,
      expected: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => false,
      },
    });
  },
  ["signal(true) and false"]: () => {
    assert({
      actual: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => true,
      },
      expected: false,
    });
  },
  ["signal(true) and 1"]: () => {
    assert({
      actual: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => true,
      },
      expected: 1,
    });
  },
  ["signal({ foo: true }) and signal({ a: false })"]: () => {
    assert({
      actual: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => ({ foo: true }),
      },
      expected: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => ({ foo: false }),
      },
    });
  },
  ["signal([true]) and signal([false]) with props"]: () => {
    assert({
      actual: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => [true],
        a: true,
      },
      expected: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => [false],
        a: false,
      },
    });
  },
  ["signal([true]) and [true]"]: () => {
    assert({
      actual: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => [true],
      },
      expected: [true],
    });
  },
  ["[true] and signal([true])"]: () => {
    assert({
      actual: [true],
      expected: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => [true],
      },
    });
  },
  ["[true] and signal([false])"]: () => {
    assert({
      actual: [true],
      expected: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => [false],
      },
    });
  },
  ["signal([true]) and false"]: () => {
    assert({
      actual: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => [true],
      },
      expected: [false],
    });
  },
  ["signal(string) and signal(string)"]: () => {
    assert({
      actual: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => "a",
      },
      expected: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => "ab",
      },
    });
  },
  ["signal(string) and string"]: () => {
    assert({
      actual: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => "a",
      },
      expected: "a",
    });
  },
  ["string and signal(string)"]: () => {
    assert({
      actual: "a",
      expected: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => "a",
      },
    });
  },
  ["valueOf not displayed when return object itself"]: () => {
    const actual = { a: true, valueOf: () => actual };
    const expected = { a: false, valueOf: () => expected };
    assert({
      actual,
      expected,
    });
  },
  ["valueOf self and valueOf 10"]: () => {
    const actual = { valueOf: () => actual };
    const expected = { valueOf: () => "10" };
    assert({
      actual,
      expected,
    });
  },
});
