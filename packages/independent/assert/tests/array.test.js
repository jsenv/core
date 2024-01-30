import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("array", {
  ["object expected, array received"]: () => {
    assert({
      actual: [],
      expected: {},
    });
  },
});
