import { startSnapshotTesting } from "./start_snapshot_testing.js";
import { assert } from "@jsenv/assert";

await startSnapshotTesting("map", {
  maps_are_empty: () => {
    assert({
      actual: new Map(),
      expected: new Map(),
    });
  },
  maps_with_same_string_entries: () => {
    const actual = new Map();
    actual.set("answer", 42);
    const expected = new Map();
    expected.set("answer", 42);
    assert({ actual, expected });
  },
  maps_with_same_object_entries: () => {
    const actual = new Map();
    actual.set({}, 42);
    actual.set({}, 43);
    const expected = new Map();
    expected.set({}, 42);
    expected.set({}, 43);
    assert({ actual, expected });
  },
  fail_key_object: () => {
    const actual = new Map();
    actual.set({}, 42);
    actual.set({ foo: true }, 43);
    const expected = new Map();
    expected.set({}, 42);
    expected.set({}, 43);
    assert({ actual, expected });
  },
  fail_value_object: () => {
    const actual = new Map();
    actual.set("foo", { foo: true });
    const expected = new Map();
    expected.set("foo", { foo: false });
    assert({ actual, expected });
  },
  fail_2_extra_entry: () => {
    const actual = new Map();
    actual.set("foo", true);
    actual.set("bar", true);
    const expected = new Map();
    assert({ actual, expected });
  },
  fail_2_missing_entry: () => {
    const actual = new Map();
    const expected = new Map();
    expected.set("foo", true);
    expected.set("bar", true);
    assert({ actual, expected });
  },
});
