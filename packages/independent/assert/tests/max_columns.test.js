import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("max_columns", {
  ["maxColumns respect actual prefix"]: () => {
    assert({
      actual: "a_string",
      expected: "a_string_2",
      maxColumns: 15,
    });
  },
  ["maxColumns respect indent"]: () => {
    assert({
      actual: {
        a: "a_long_string",
        b: false,
      },
      expected: {
        a: "a_long_string",
        b: true,
      },
      maxColumns: 10,
    });
  },
});
