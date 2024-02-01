import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("prototype", {
  //   ["object null proto vs object"]: () => {
  //     assert({
  //       actual: Object.create(null),
  //       expected: {},
  //     });
  //   },
  ["object with different prototypes"]: () => {
    // some well-known proto
    // will just be displayed as
    // Date() {}
    // but when created as follow, there is no way to properly
    // display them (we'll see about Symbol.toStringTag at some point but later)
    // so we must display the entire object
    assert({
      actual: Object.create({ toto: true }),
      expected: Object.create({ toto: false }),
    });
  },
});
