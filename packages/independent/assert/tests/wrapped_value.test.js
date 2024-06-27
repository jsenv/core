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
});
