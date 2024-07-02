import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";

await startSnapshotTesting("assert_not", {
  "42 and not(42)": () => {
    assert({
      actual: 42,
      expect: assert.not(42),
    });
  },
  "41 and not(42)": () => {
    assert({
      actual: {
        a: true,
        b: 41,
      },
      expect: {
        a: false,
        b: assert.not(42),
      },
    });
  },
  "object and not (object)": () => {
    assert({
      actual: { a: true },
      expect: assert.not({ a: true }),
    });
  },
  "object and not(object)": () => {
    assert({
      actual: {
        a: true,
        b: { b2: true },
      },
      expect: {
        a: false,
        b: assert.not({ b2: false }),
      },
    });
  },
});
