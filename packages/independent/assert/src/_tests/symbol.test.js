import { startSnapshotTesting } from "./start_snapshot_testing.js";
import { assert } from "@jsenv/assert";

await startSnapshotTesting("symbol", {
  same_symbols: () => {
    const symbol = Symbol();
    assert({
      actual: symbol,
      expected: symbol,
    });
  },
  same_symbol_registered: () => {
    assert({
      actual: Symbol.for("foo"),
      expected: Symbol.for("foo"),
    });
  },
  fail_symbol: () => {
    assert({
      actual: Symbol(),
      expected: Symbol(),
    });
  },
  fail_symbol_named: () => {
    assert({
      actual: Symbol("foo"),
      expected: Symbol("bar"),
    });
  },
  // ensure failure on symbol value prevails on failure associated to extra symbol
  // (because it gives more helpful error message)
  toto: () => {
    const symbola = Symbol("a");
    const symbolb = Symbol("b");
    assert({
      actual: { [symbola]: true },
      expected: { [symbola]: false, [symbolb]: true },
    });
  },
});
