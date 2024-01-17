import { startSnapshotTesting } from "./start_snapshot_testing.js";
import { assert } from "@jsenv/assert";

const booleanSnapshotTesting = startSnapshotTesting("boolean");

assert({
  actual: true,
  expected: true,
});
assert({
  // eslint-disable-next-line no-new-wrappers
  actual: new Boolean(true),
  // eslint-disable-next-line no-new-wrappers
  expected: new Boolean(true),
});

try {
  assert({
    actual: true,
    expected: false,
  });
} catch (e) {
  booleanSnapshotTesting.writeError(e, "boolean_fail.txt");
}
try {
  assert({
    // eslint-disable-next-line no-new-wrappers
    actual: new Boolean(true),
    // eslint-disable-next-line no-new-wrappers
    expected: new Boolean(false),
  });
} catch (e) {
  booleanSnapshotTesting.writeError(e, "boolean_object_fail.txt");
}
try {
  assert({
    actual: 0,
    expected: false,
  });
} catch (e) {
  booleanSnapshotTesting.writeError(e, "boolean_fail_0_false.txt");
}
try {
  assert({
    actual: 1,
    expected: true,
  });
} catch (e) {
  booleanSnapshotTesting.writeError(e, "boolean_fail_1_true.txt");
}
