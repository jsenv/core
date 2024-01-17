import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";

import { assert } from "@jsenv/assert";

await startSnapshotTesting("extensibility", {
  basic: () => {
    assert({
      actual: Object.preventExtensions({ foo: true }),
      expected: Object.preventExtensions({ foo: true }),
    });
  },
  fail_should_be_non_extensible: () => {
    assert({
      actual: { foo: true },
      expected: Object.preventExtensions({ foo: true }),
    });
  },
  fail_should_be_extensible: () => {
    assert({
      actual: Object.preventExtensions({ foo: true }),
      expected: { foo: true },
    });
  },
});
