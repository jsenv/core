import { assert } from "@jsenv/assert";
import { snapshotAssertTests } from "@jsenv/assert/tests/snapshot_assert.js";

await snapshotAssertTests(import.meta.url, ({ test }) => {
  test("0.1 + 0.2 is close to 0.3", () => {
    assert({
      actual: {
        a: 0.1 + 0.2,
        b: true,
      },
      expect: {
        a: assert.closeTo(0.3),
        b: false,
      },
    });
  });
  test("on a string", () => {
    assert({
      actual: "toto",
      expect: assert.closeTo(0.4),
    });
  });
  test("0.3 and 0.4", () => {
    assert({
      actual: 0.1 + 0.2,
      expect: assert.closeTo(0.4),
    });
  });
});
