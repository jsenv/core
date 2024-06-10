import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./start_snapshot_testing.js";

await startSnapshotTesting("boolean", {
  ["true should be false"]: () => {
    assert({
      actual: true,
      expect: false,
    });
  },
  // ["false should be true"]: () => {
  //   assert({
  //     actual: false,
  //     expect: true,
  //   });
  // },
  // ["true should be 1"]: () => {
  //   assert({
  //     actual: true,
  //     expect: 1,
  //   });
  // },
  // ["false should be 0"]: () => {
  //   assert({
  //     actual: false,
  //     expect: 0,
  //   });
  // },
});
