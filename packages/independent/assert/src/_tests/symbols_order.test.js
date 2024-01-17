import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";
import { assert } from "@jsenv/assert";

await startSnapshotTesting("symbol_order", {
  same_symbol_order: () => {
    const symbola = Symbol("a");
    const symbolb = Symbol("b");
    assert({
      actual: { [symbola]: true, [symbolb]: true },
      expected: { [symbola]: true, [symbolb]: true },
    });
  },
  fail_symbol_order: () => {
    const symbola = Symbol("a");
    const symbolb = Symbol("b");
    assert({
      actual: {
        [symbolb]: true,
        [symbola]: true,
      },
      expected: {
        [symbola]: true,
        [symbolb]: true,
      },
    });
  },
});
