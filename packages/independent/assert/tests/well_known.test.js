import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./start_snapshot_testing.js";

await startSnapshotTesting("well_known", {
  ["String and Object"]: () => {
    assert({
      actual: String,
      expect: Object,
    });
  },
});
