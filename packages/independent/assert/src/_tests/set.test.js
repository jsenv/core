import { startSnapshotTesting } from "./start_snapshot_testing.js";
import { assert } from "@jsenv/assert";

await startSnapshotTesting("set", {
  same_set: () => {
    assert({
      actual: new Set(),
      expected: new Set(),
    });
  },
  same_set_with_one_entry: () => {
    assert({
      actual: new Set([0]),
      expected: new Set([0]),
    });
  },
  fail_set_first_entry: () => {
    assert({
      actual: new Set([{ foo: true }]),
      expected: new Set([{ foo: false }]),
    });
  },
  fail_set_2_missing_entry: () => {
    assert({
      actual: new Set(),
      expected: new Set(["a", "b"]),
    });
  },
  fail_set_2_extra_entry: () => {
    assert({
      actual: new Set(["a", "b"]),
      expected: new Set(),
    });
  },
});
