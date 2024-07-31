import { assert } from "@jsenv/assert";
import { snapshotAssertTests } from "@jsenv/assert/tests/snapshot_assert.js";

await snapshotAssertTests(import.meta.url, ({ test }) => {
  test("42 and not(42)", () => {
    assert({
      actual: 42,
      expect: assert.not(42),
    });
  });
  test("41 and not(42)", () => {
    assert({
      actual: {
        a: true,
        b: 41,
      },
      expect: {
        a: false,
        b: assert.not(42),
      },
    });
  });
  test("object and not (object)", () => {
    assert({
      actual: { a: true },
      expect: assert.not({ a: true }),
    });
  });
  test("object and not(object)", () => {
    assert({
      actual: {
        a: true,
        b: { b2: true },
      },
      expect: {
        a: false,
        b: assert.not({ b2: false }),
      },
    });
  });
});
