import { assert } from "@jsenv/assert";
import { snapshotAssertTests } from "@jsenv/assert/tests/snapshot_assert.js";

await snapshotAssertTests(import.meta.url, ({ test }) => {
  test("works", () => {
    assert({
      actual: {
        a: "expired 3 seconds ago",
        b: true,
      },
      expect: {
        a: assert.matches(/expired \d seconds ago/),
        b: false,
      },
    });
  });

  test("does not", () => {
    assert({
      actual: "expired n seconds ago",
      expect: assert.matches(/expired \d seconds ago/),
    });
  });

  test("inside array matching", () => {
    assert({
      actual: ["expired 3 seconds ago"],
      expect: [assert.matches(/expired \d seconds ago/)],
    });
  });

  test("inside array not matching", () => {
    assert({
      actual: ["expired A seconds ago"],
      expect: [assert.matches(/expired \d seconds ago/)],
    });
  });

  test("inside second array not matching", () => {
    assert({
      actual: ["before", "expired A seconds ago", "after"],
      expect: ["before", assert.matches(/expired \d seconds ago/), "after"],
    });
  });
});
