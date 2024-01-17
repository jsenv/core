import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";
import { assert } from "@jsenv/assert";

await startSnapshotTesting("property_value", {
  same_value_on_string_property: () => {
    assert({
      actual: { foo: true },
      expected: { foo: true },
    });
  },
  same_value_on_symbol_property: () => {
    const symbol = Symbol();
    assert({
      actual: { [symbol]: true },
      expected: { [symbol]: true },
    });
  },
  fail_value_on_string_property: () => {
    assert({
      actual: { foo: true },
      expected: { foo: false },
    });
  },
  fail_value_on_string_with_spaces_property: () => {
    assert({
      actual: { ["with space"]: true },
      expected: { ["with space"]: false },
    });
  },
  fail_value_on_symbol_property: () => {
    const symbol = Symbol();
    assert({
      actual: { [symbol]: true },
      expected: { [symbol]: false },
    });
  },
  fail_value_on_symbol_iterator: () => {
    const symbol = Symbol.iterator;
    assert({
      actual: { [symbol]: true },
      expected: { [symbol]: false },
    });
  },
  fail_value_on_named_symbol: () => {
    const symbol = Symbol("foo");
    assert({
      actual: { [symbol]: true },
      expected: { [symbol]: false },
    });
  },
  fail_value_on_registered_symbol: () => {
    const symbol = Symbol.for("foo");

    assert({
      actual: { [symbol]: true },
      expected: { [symbol]: false },
    });
  },
});
