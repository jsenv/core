import { startSnapshotTesting } from "./start_snapshot_testing.js";
import { assert } from "@jsenv/assert";

await startSnapshotTesting("properties_order", {
  same_property_order: () => {
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
  // properties order is only on enumerable properties
  // this is because code is unlikely going to rely on non enumerable property order
  // it also fixes an strange issue on webkit where
  // Object.getOwnPropertyNames(function() {}) inconsistently returns either
  // ["name", "prototype", "length"]
  // or
  // ["length", "name", "prototype"]
  different_order_non_enumerable: () => {
    const actual = {};
    Object.defineProperty(actual, "bar", { enumerable: false });
    Object.defineProperty(actual, "foo", { enumerable: false });
    const expected = {};
    Object.defineProperty(expected, "foo", { enumerable: false });
    Object.defineProperty(expected, "bar", { enumerable: false });
    assert({ actual, expected });
  },
  fail_property_order: () => {
    assert({
      actual: {
        foo: true,
        bar: true,
      },
      expected: {
        bar: true,
        foo: true,
      },
    });
  },
});
