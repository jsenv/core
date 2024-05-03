import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("number", {
  ["-0 and 0"]: () => {
    assert({
      actual: -0,
      expect: +0,
    });
  },
  ["1 and -0"]: () => {
    assert({
      actual: 1,
      expect: -0,
    });
  },
  ["-1 and 1"]: () => {
    assert({
      actual: -1,
      expect: 1,
    });
  },
  ["-Infinity and Infinity"]: () => {
    assert({
      actual: -Infinity,
      expect: Infinity,
    });
  },
  ["NaN and Infinity"]: () => {
    assert({
      actual: NaN,
      expect: Infinity,
    });
  },
});
