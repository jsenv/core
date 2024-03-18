import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("boolean", {
  ["true should be false"]: () => {
    assert({
      actual: true,
      expected: false,
    });
  },
  // ["false should be true"]: () => {
  //   assert({
  //     actual: false,
  //     expected: true,
  //   });
  // },
  // ["true should be 1"]: () => {
  //   assert({
  //     actual: true,
  //     expected: 1,
  //   });
  // },
  // ["false should be 0"]: () => {
  //   assert({
  //     actual: false,
  //     expected: 0,
  //   });
  // },
});
