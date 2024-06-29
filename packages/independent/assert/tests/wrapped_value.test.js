import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./start_snapshot_testing.js";

await startSnapshotTesting("wrapped_value", ({ test }) => {
  test("Symbol.toPrimitive added", () => {
    assert({
      actual: {
        [Symbol.toPrimitive]: () => {
          return "10";
        },
      },
      expect: {},
    });
  });
  test("Symbol.toPrimitive removed", () => {
    assert({
      actual: {},
      expect: {
        [Symbol.toPrimitive]: () => {
          return "10";
        },
      },
    });
  });
  test("Symbol.toPrimitive vs primitive", () => {
    assert({
      actual: {
        [Symbol.toPrimitive]: () => {
          return 10;
        },
      },
      expect: 10,
    });
  });
  test("primitive vs Symbol.toPrimitive", () => {
    assert({
      actual: "10",
      expect: {
        [Symbol.toPrimitive]: () => {
          return "10";
        },
      },
    });
  });
  test("valueOf({ a: true }) vs { a: true }", () => {
    assert({
      actual: {
        valueOf: () => {
          return { a: true };
        },
      },
      expect: { a: false },
    });
  });
  test("10 vs valueOf(10)", () => {
    assert({
      actual: 10,
      expect: {
        valueOf: () => 10,
      },
    });
  });
  test("valueOf(10) vs 10", () => {
    assert({
      actual: {
        valueOf: () => 10,
      },
      expect: 10,
    });
  });
  test("valueOf(10) vs valueOf(11)", () => {
    assert({
      actual: {
        valueOf: () => 10,
      },
      expect: {
        valueOf: () => 11,
      },
    });
  });
  test("valueOf(10) vs valueOf(10)", () => {
    assert({
      actual: {
        a: true,
        valueOf: () => 10,
      },
      expect: {
        b: false,
        valueOf: () => 10,
      },
    });
  });
  test("valueOf with object tag vs primitive", () => {
    assert({
      actual: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => {
          return 10;
        },
      },
      expect: false,
    });
  });
  test("valueOf with object tag ", () => {
    assert({
      actual: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => {
          return 10;
        },
      },
      expect: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => {
          return 11;
        },
      },
    });
  });
  test("no diff on valueOf in constructor", () => {
    assert({
      actual: {
        a: true,
        [Symbol.toStringTag]: "Signal",
        valueOf: () => {
          return 10;
        },
      },
      expect: {
        a: false,
        [Symbol.toStringTag]: "Signal",
        valueOf: () => {
          return 10;
        },
      },
    });
  });
  test("signal(true) and signal(false)", () => {
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
  });
  test("signal(true) and true", () => {
    assert({
      actual: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => true,
      },
      expect: true,
    });
  });
  test("true and signal(true)", () => {
    assert({
      actual: true,
      expect: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => true,
      },
    });
  });
  test("true and signal(false)", () => {
    assert({
      actual: true,
      expect: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => false,
      },
    });
  });
  test("signal(true) and false", () => {
    assert({
      actual: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => true,
      },
      expect: false,
    });
  });
  test("signal(true) and 1", () => {
    assert({
      actual: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => true,
      },
      expect: 1,
    });
  });
  test("signal({ foo: true }) and signal({ foo: false })", () => {
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
  });
  test("signal([true]) and signal([false]) with props", () => {
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
  });
  test("signal([true]) and [true]", () => {
    assert({
      actual: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => [true],
      },
      expect: [true],
    });
  });
  test("[true] and signal([true])", () => {
    assert({
      actual: [true],
      expect: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => [true],
      },
    });
  });
  test("[true] and signal([false])", () => {
    assert({
      actual: [true],
      expect: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => [false],
      },
    });
  });
  test("signal([true]) and [false]", () => {
    assert({
      actual: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => [true],
      },
      expect: [false],
    });
  });
  test("signal(string) and signal(string)", () => {
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
  });
  test("signal(string) and string", () => {
    assert({
      actual: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => "a",
      },
      expect: "a",
    });
  });
  test("string and signal(string)", () => {
    assert({
      actual: "a",
      expect: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => "a",
      },
    });
  });
  test("both valueOf return object itself", () => {
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
  });
  test("valueOf self and valueOf 10", () => {
    const actual = { valueOf: () => actual };
    const expect = { valueOf: () => 10 };
    assert({
      actual,
      expect,
    });
  });
  test("valueOf 10 and valueOf self", () => {
    const actual = { valueOf: () => 10 };
    const expect = { valueOf: () => expect };
    assert({
      actual,
      expect,
    });
  });
  // (valueOf stays between a and b in the diff)
  test("own valueOf order respected", () => {
    assert({
      actual: {
        a: true,
        valueOf: () => 0,
        b: true,
      },
      expect: {
        a: true,
        valueOf: () => 1,
        b: true,
      },
    });
  });
  test("valueOf inherited", () => {
    class Signal {
      #value;
      constructor(value) {
        this.#value = value;
      }
      valueOf() {
        return this.#value;
      }
    }
    assert({
      actual: Object.assign(new Signal("a"), { foo: true }),
      expect: Object.assign(new Signal("b"), { foo: false }),
    });
  });
});
