import { startSnapshotTesting } from "./start_snapshot_testing.js";
import { assert } from "@jsenv/assert";

await startSnapshotTesting("integrity", {
  seal: () => {
    assert({
      actual: Object.seal({ foo: true }),
      expected: Object.seal({ foo: true }),
    });
  },
  freeze: () => {
    assert({
      actual: Object.freeze({}),
      expected: Object.freeze({}),
    });
  },
  fail_should_be_sealed: () => {
    assert({
      actual: {},
      // the foo property is here to ensure integrity is checked before property
      expected: Object.seal({ foo: true }),
    });
  },
  fail_should_not_be_sealed: () => {
    assert({
      // the foo property is here to ensure integrity is checked before property
      actual: Object.seal({ foo: true }),
      expected: {},
    });
  },
  fail_should_be_frozen: () => {
    assert({
      actual: {},
      expected: Object.freeze({}),
    });
  },
  fail_should_not_be_frozen: () => {
    assert({
      actual: Object.freeze({}),
      expected: {},
    });
  },
  fail_should_be_sealed_not_frozen: () => {
    assert({
      actual: Object.freeze({}),
      expected: Object.seal({ foo: true }),
    });
  },
  fail_should_be_frozen_not_sealed: () => {
    assert({
      actual: Object.seal({ foo: true }),
      expected: Object.freeze({}),
    });
  },
});
