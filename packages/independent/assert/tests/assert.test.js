import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("assert", {
  basic: () => {
    assert({
      actual: true,
      expected: false,
    });
  },
});
