import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";

import { assert } from "@jsenv/assert";

await startSnapshotTesting("reference", {
  same_ref: () => {
    const actual = {};
    actual.self = actual;
    const expected = {};
    expected.self = expected;
    assert({ actual, expected });
  },
  same_parent_ref: () => {
    const actual = {};
    actual.object = { parent: actual };
    const expected = {};
    expected.object = { parent: expected };
    assert({ actual, expected });
  },
  same_ref_twice: () => {
    const actual = {};
    actual.object = { self: actual, self2: actual };
    const expected = {};
    expected.object = { self: expected, self2: expected };
    assert({ actual, expected });
  },
  fail_should_be_a_reference: () => {
    const actual = {};
    actual.self = {};
    const expected = {};
    expected.self = expected;
    assert({ actual, expected });
  },
  fail_should_not_be_a_reference: () => {
    const actual = {};
    actual.self = actual;
    const expected = {};
    expected.self = {};
    assert({ actual, expected });
  },
  fail_should_not_be_a_reference_nested: () => {
    const actual = { object: {} };
    actual.object.self = {};
    const expected = { object: {} };
    expected.object.self = expected.object;
    assert({ actual, expected });
  },
  fail_different_references: () => {
    const actual = { object: {} };
    actual.object.self = actual;
    const expected = { object: {} };
    expected.object.self = expected.object;
    assert({ actual, expected });
  },
});
