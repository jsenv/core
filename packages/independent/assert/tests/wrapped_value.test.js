import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./start_snapshot_testing.js";

await startSnapshotTesting("wrapped_value", {
  ["Symbol.toPrimitive added"]: () => {
    assert({
      actual: {
        [Symbol.toPrimitive]: () => {
          return "10";
        },
      },
      expect: {},
    });
  },
  ["Symbol.toPrimitive removed"]: () => {
    assert({
      actual: {},
      expect: {
        [Symbol.toPrimitive]: () => {
          return "10";
        },
      },
    });
  },
  ["Symbol.toPrimitive vs primitive"]: () => {
    assert({
      actual: {
        [Symbol.toPrimitive]: () => {
          return "10";
        },
      },
      expect: "10",
    });
  },
  ["primitive vs Symbol.toPrimitive"]: () => {
    assert({
      actual: "10",
      expect: {
        [Symbol.toPrimitive]: () => {
          return "10";
        },
      },
    });
  },
  ["valueOf({ a: true }) vs { a: true }"]: () => {
    assert({
      actual: {
        valueOf: () => {
          return { a: true };
        },
      },
      expect: { a: false },
    });
  },
  ["10 vs valueOf(10)"]: () => {
    assert({
      actual: 10,
      expect: {
        valueOf: () => 10,
      },
    });
  },
  ["valueOf(10) vs 10"]: () => {
    assert({
      actual: {
        valueOf: () => 10,
      },
      expect: 10,
    });
  },
  ["valueOf(10) vs valueOf(11)"]: () => {
    assert({
      actual: {
        valueOf: () => 10,
      },
      expect: {
        valueOf: () => 11,
      },
    });
  },
  ["valueOf(10) vs valueOf(10)"]: () => {
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
  },
  ["valueOf with object tag"]: () => {
    assert({
      actual: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => {
          return 10;
        },
      },
      expect: false,
    });
  },
});
