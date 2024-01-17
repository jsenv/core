import { startSnapshotTesting } from "./start_snapshot_testing.js";
import { executeInNewContext } from "../executeInNewContext.js";
import { assert } from "@jsenv/assert";

const arraySnapshotTesting = startSnapshotTesting("array");

assert({
  actual: [],
  expected: [],
});
assert({
  actual: [0],
  expected: [0],
});
assert({
  actual: await executeInNewContext("[]"),
  expected: [],
});

try {
  assert({
    actual: [0, 1],
    expected: [0],
  });
} catch (e) {
  arraySnapshotTesting.writeError(e, "array_too_big");
}
try {
  assert({
    actual: [0],
    expected: [0, 1],
  });
} catch (e) {
  arraySnapshotTesting.writeError(e, "array_too_small");
}
try {
  assert({
    actual: ["a"],
    expected: ["b"],
  });
} catch (e) {
  arraySnapshotTesting.writeError(e, "array_mismatch_at_0");
}
try {
  assert({
    actual: {},
    expected: [],
  });
} catch (e) {
  arraySnapshotTesting.writeError(e, "array_fail_prototype");
}
try {
  assert({
    actual: { length: 0 },
    expected: { length: 1 },
  });
} catch (e) {
  arraySnapshotTesting.writeError(e, "array_like_length_mismatch");
}
try {
  const actual = [];
  actual.foo = true;
  const expected = [];
  expected.foo = false;
  assert({ actual, expected });
} catch (e) {
  arraySnapshotTesting.writeError(e, "array_fail_property");
}
try {
  const symbol = Symbol();
  const actual = [];
  actual[symbol] = true;
  const expected = [];
  expected[symbol] = false;
  assert({ actual, expected });
} catch (e) {
  arraySnapshotTesting.writeError(e, "array_fail_symbol");
}

arraySnapshotTesting.end();
