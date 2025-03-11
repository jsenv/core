import { assert } from "@jsenv/assert";
import { snapshotAssertTests } from "@jsenv/assert/tests/snapshot_assert.js";

await snapshotAssertTests(import.meta.url, ({ test }) => {
  test("below or equals", () => {
    assert({
      actual: 50,
      expect: assert.belowOrEquals(25),
    });
  });
  test("below or equals when removed", () => {
    assert({
      actual: {},
      expect: {
        a: assert.belowOrEquals(25),
      },
    });
  });
  test("below or equals ok", () => {
    assert({
      actual: {
        a: true,
        b: 25,
      },
      expect: {
        a: false,
        b: assert.belowOrEquals(25),
      },
    });
  });
  test("50 is too small", () => {
    assert({
      actual: 50,
      expect: assert.between(100, 200),
    });
  });
  test("500 not between 100, 200", () => {
    assert({
      actual: {
        duration: 500,
      },
      expect: {
        duration: assert.between(100, 200),
      },
    });
  });
  test("3500 is between 3000 and 5000", () => {
    assert({
      actual: {
        a: 3_500,
        b: true,
      },
      expect: {
        a: assert.between(3_000, 5_000),
        b: false,
      },
    });
  });
  // "250 is too big": () => {
  //   assert({
  //     actual: 42,
  //     expect: assert.not(100, 200),
  //   });
  // },
  // "string is not between 100,200": () => {
  //   assert({
  //     actual: "toto",
  //     expect: assert.between(100, 200),
  //   });
  // },
});
