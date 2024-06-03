import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./start_snapshot_testing.js";

await startSnapshotTesting("assert_not", {
  "42 and not(42)": () => {
    assert({
      actual: 42,
      expected: assert.not(42),
    });
  },
  //   "41 and not(42)": () => {
  //     assert({
  //       actual: {
  //         a: true,
  //         b: 41,
  //       },
  //       expected: {
  //         a: false,
  //         b: assert.not(42),
  //       },
  //     });
  //   },
});
