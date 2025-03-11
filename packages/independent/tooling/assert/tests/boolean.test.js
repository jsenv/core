import { assert } from "@jsenv/assert";
import { snapshotAssertTests } from "@jsenv/assert/tests/snapshot_assert.js";

await snapshotAssertTests(import.meta.url, ({ test }) => {
  test("true should be false", () => {
    assert({
      actual: true,
      expect: false,
    });
  });
  test("false should be true", () => {
    assert({
      actual: false,
      expect: true,
    });
  });
  test("true should be 1", () => {
    assert({
      actual: true,
      expect: 1,
    });
  });
  test("false should be 0", () => {
    assert({
      actual: false,
      expect: 0,
    });
  });
});
