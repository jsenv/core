import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("url", {
  ["url port"]: () => {
    assert({
      actual: new URL("http://example.com"),
      expected: new URL("http://example.com:8000"),
    });
  },
});
