import { startSnapshotTesting } from "./start_snapshot_testing.js";
import { assert } from "@jsenv/assert";

await startSnapshotTesting("symbol_properties", {
  same_symbols: () => {
    const symbola = Symbol("a");
    const symbolb = Symbol("b");
    assert({
      actual: {
        [symbola]: true,
        [symbolb]: true,
      },
      expected: {
        [symbola]: true,
        [symbolb]: true,
      },
    });
  },
  fail_1_extra_symbol_property: () => {
    const symbola = Symbol("a");
    assert({
      actual: { [symbola]: true },
      expected: {},
    });
  },
  fail_1_missing_symbol_property: () => {
    const symbola = Symbol("a");
    assert({
      actual: {},
      expected: { [symbola]: true },
    });
  },
  fail_2_extra_and_2_missing_symbol_property: () => {
    const symbola = Symbol("a");
    const symbolb = Symbol("b");
    const symbolc = Symbol("c");
    const symbold = Symbol("d");
    const symbole = Symbol("e");
    assert({
      actual: {
        [symbola]: true,
        [symbold]: true,
        [symbole]: true,
      },
      expected: {
        [symbola]: true,
        [symbolb]: true,
        [symbolc]: true,
      },
    });
  },
});
