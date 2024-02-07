import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("prototype", {
  ["object null proto vs object"]: () => {
    assert({
      actual: Object.create(null),
      expected: {},
    });
  },
  ["object with different prototypes"]: () => {
    assert({
      actual: Object.create({ toto: true }),
      expected: Object.create({ toto: false }),
    });
  },
});
