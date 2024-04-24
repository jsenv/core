import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("promise", {
  ["promise"]: () => {
    assert({
      actual: {
        a: true,
        b: Promise.resolve(40),
      },
      expect: {
        a: false,
        b: Promise.resolve(42),
      },
    });
  },
});
