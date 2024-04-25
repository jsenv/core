/* eslint-disable no-new-wrappers */

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
  ["diff new String value"]: () => {
    assert({
      actual: new String("a"),
      expect: new String("b"),
    });
  },
  ["diff String object vs literal"]: () => {
    assert({
      actual: new String("abc"),
      expect: "a2",
    });
  },
  ["new String collapsed with overview"]: () => {
    assert({
      actual: {
        a: new String("toto"),
        b: true,
      },
      expect: {
        a: new String("toto"),
        b: false,
      },
    });
  },
  ["new String collapsed"]: () => {
    assert({
      actual: {
        foo: {
          a: new String("toto"),
        },
      },
      expect: {
        bar: {
          a: new String("toto"),
        },
      },
      maxDepthInsideDiff: 0,
    });
  },
  ["new String prop"]: () => {
    assert({
      actual: Object.assign(new String("a"), { foo: true }),
      expect: Object.assign(new String("b"), { foo: false }),
    });
  },
  ["signal(true) and signal(false)"]: () => {
    assert({
      actual: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => true,
      },
      expect: {
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
      expect: true,
    });
  },
  ["true and signal(true)"]: () => {
    assert({
      actual: true,
      expect: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => true,
      },
    });
  },
  ["true and signal(false)"]: () => {
    assert({
      actual: true,
      expect: {
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
      expect: false,
    });
  },
  ["signal(true) and 1"]: () => {
    assert({
      actual: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => true,
      },
      expect: 1,
    });
  },
  ["signal({ foo: true }) and signal({ foo: false })"]: () => {
    assert({
      actual: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => ({ foo: true }),
      },
      expect: {
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
      expect: {
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
      expect: [true],
    });
  },
  ["[true] and signal([true])"]: () => {
    assert({
      actual: [true],
      expect: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => [true],
      },
    });
  },
  ["[true] and signal([false])"]: () => {
    assert({
      actual: [true],
      expect: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => [false],
      },
    });
  },
  ["signal([true]) and [false]"]: () => {
    assert({
      actual: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => [true],
      },
      expect: [false],
    });
  },
  ["signal(string) and signal(string)"]: () => {
    assert({
      actual: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => "ab",
      },
      expect: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => "a",
      },
    });
  },
  ["signal(string) and string"]: () => {
    assert({
      actual: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => "a",
      },
      expect: "a",
    });
  },
  ["string and signal(string)"]: () => {
    assert({
      actual: "a",
      expect: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => "a",
      },
    });
  },
  ["both valueOf return object itself"]: () => {
    const actual = {
      a: true,
      valueOf: () => actual,
    };
    const expect = {
      a: false,
      valueOf: () => expect,
    };
    assert({
      actual,
      expect,
    });
  },
  ["valueOf self and valueOf 10"]: () => {
    const actual = { valueOf: () => actual };
    const expect = { valueOf: () => 10 };
    assert({
      actual,
      expect,
    });
  },
  ["valueOf 10 and valueOf self"]: () => {
    const actual = { valueOf: () => 10 };
    const expect = { valueOf: () => expect };
    assert({
      actual,
      expect,
    });
  },
  ["Symbol.toPrimitive"]: () => {
    assert({
      actual: {
        [Symbol.toPrimitive]: () => {
          return "10";
        },
      },
      expect: "10",
    });
  },
});
