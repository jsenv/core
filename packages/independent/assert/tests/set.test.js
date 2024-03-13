import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("set", {
  ["set value added"]: () => {
    assert({
      actual: new Set(["a"]),
      expected: new Set(["b"]),
    });
  },
});
