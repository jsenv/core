import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("assert", {
  //   fail_boolean: () => {
  //     assert({
  //       actual: true,
  //       expected: false,
  //     });
  //   },
  fail_property_value: () => {
    assert({
      actual: { foo: true },
      expected: { foo: false },
    });
  },
});
