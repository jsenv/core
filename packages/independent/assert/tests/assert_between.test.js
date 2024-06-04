import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./start_snapshot_testing.js";

await startSnapshotTesting("assert_not", {
  "50 is too small": () => {
    assert({
      actual: 42,
      expect: assert.between(100, 200),
    });
  },
  // "250 is too big": () => {
  //   assert({
  //     actual: 42,
  //     expect: assert.not(100, 200),
  //   });
  // },
  // "string is not between 100,200": () => {
  //   assert({
  //     actual: "toto",
  //     expected: assert.between(100, 200),
  //   });
  // },
});
