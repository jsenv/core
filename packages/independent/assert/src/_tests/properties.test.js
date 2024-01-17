import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";
import { assert } from "@jsenv/assert";

await startSnapshotTesting("properties", {
  same_properties: () => {
    assert({
      actual: {
        foo: true,
        bar: true,
      },
      expected: {
        foo: true,
        bar: true,
      },
    });
  },
  fail_1_unexpected_property: () => {
    assert({
      actual: { a: true },
      expected: {},
    });
  },
  fail_1_missing_property: () => {
    assert({
      actual: {},
      expected: { a: true },
    });
  },
  fail_1_unexpected_and_1_missing: () => {
    assert({
      actual: { a: true, d: true },
      expected: { a: true, b: true },
    });
  },
  fail_2_unexpected_property: () => {
    assert({
      actual: { a: true, b: true },
      expected: {},
    });
  },
  fail_2_missing_property: () => {
    assert({
      actual: {},
      expected: { a: true, b: true },
    });
  },
  fail_2_unexpected_and_2_missing: () => {
    assert({
      actual: { a: true, d: true, e: true },
      expected: { a: true, b: true, c: true },
    });
  },
  fail_2_unexpected_and_1_missing: () => {
    assert({
      actual: { a: true, d: true, e: true },
      expected: { a: true, b: true },
    });
  },
  fail_1_unexpected_and_2_missing: () => {
    assert({
      actual: { a: true, d: true },
      expected: { a: true, b: true, c: true },
    });
  },
  // ensure unequal property values is checked before unexpected property names
  // (because it gives more helpful error message)
  fail_property_value_before_property_name: () => {
    assert({
      actual: { a: true, c: false },
      expected: { a: false, b: true },
    });
  },
});
