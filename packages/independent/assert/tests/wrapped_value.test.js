import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./start_snapshot_testing.js";

await startSnapshotTesting("wrapped_value", {
  ["10 vs Object(10)"]: () => {
    assert({
      actual: 10,
      expect: {
        valueOf: () => 10,
      },
    });
  },
  ["Object(10) vs 10"]: () => {
    assert({
      actual: {
        valueOf: () => 10,
      },
      expect: 10,
    });
  },
  ["Object(10) vs Object(11)"]: () => {
    assert({
      actual: {
        valueOf: () => 10,
      },
      expect: {
        valueOf: () => 11,
      },
    });
  },
  ["Object({ a: true }) vs { a: true }"]: () => {
    assert({
      actual: {
        valueOf: () => {
          return { a: true };
        },
      },
      expect: { a: false },
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
