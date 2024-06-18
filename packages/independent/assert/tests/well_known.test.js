import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./start_snapshot_testing.js";

await startSnapshotTesting("well_known", {
  ["String and Object"]: () => {
    assert({
      actual: String,
      expect: Object,
    });
  },
  ["Number.MAX_VALUE and Number.MIN_VALUE"]: () => {
    assert({
      actual: Number.MAX_VALUE,
      expect: Number.MIN_VALUE,
    });
  },
  ["Symbol.iterator and Symbol.toPrimitive"]: () => {
    assert({
      actual: Symbol.iterator,
      expect: Symbol.toPrimitive,
    });
  },
});
