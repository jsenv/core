import stripAnsi from "strip-ansi";
import { takeDirectorySnapshot } from "@jsenv/snapshot";
import { assert } from "@jsenv/assert";
import { writeFileSync } from "@jsenv/filesystem";

import { executeInNewContext } from "../../executeInNewContext.js";

const snapshotDirectoryUrl = new URL("./snapshots/", import.meta.url);
const directorySnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
const writeErrorSnapshot = (error, filename) => {
  const snapshotFileUrl = new URL(filename, snapshotDirectoryUrl);
  writeFileSync(snapshotFileUrl, stripAnsi(error.message));
};

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
  writeErrorSnapshot(e, "array_too_big.txt");
}
try {
  assert({
    actual: [0],
    expected: [0, 1],
  });
} catch (e) {
  writeErrorSnapshot(e, "array_too_small.txt");
}
try {
  assert({
    actual: ["a"],
    expected: ["b"],
  });
} catch (e) {
  writeErrorSnapshot(e, "array_mismatch_at_0.txt");
}
try {
  assert({
    actual: {},
    expected: [],
  });
} catch (e) {
  writeErrorSnapshot(e, "array_fail_prototype.txt");
}
try {
  assert({
    actual: { length: 0 },
    expected: { length: 1 },
  });
} catch (e) {
  writeErrorSnapshot(e, "array_like_length_mismatch.txt");
}
try {
  const actual = [];
  actual.foo = true;
  const expected = [];
  expected.foo = false;
  assert({ actual, expected });
} catch (e) {
  writeErrorSnapshot(e, "array_fail_property.txt");
}
try {
  const symbol = Symbol();
  const actual = [];
  actual[symbol] = true;
  const expected = [];
  expected[symbol] = false;
  assert({ actual, expected });
} catch (e) {
  writeErrorSnapshot(e, "array_fail_symbol.txt");
}

directorySnapshot.compare();
