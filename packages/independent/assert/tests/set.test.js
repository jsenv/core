import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("set", {
  // ["set value added"]: () => {
  //   assert({
  //     actual: new Set(["a", "b", "c", "Y"]),
  //     expected: new Set(["b", "a", "c", "Z"]),
  //   });
  // },
  ["compare set and array"]: () => {
    assert({
      actual: ["a", "b"],
      expected: new Set(["a", "b"]),
    });
  },
});
