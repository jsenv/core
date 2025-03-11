import { assert } from "@jsenv/assert";
import { snapshotAssertTests } from "@jsenv/assert/tests/snapshot_assert.js";

await snapshotAssertTests(import.meta.url, ({ test }) => {
  test("String and Object", () => {
    assert({
      actual: String,
      expect: Object,
    });
  });
  test("Number.MAX_VALUE and Number.MIN_VALUE", () => {
    assert({
      actual: Number.MAX_VALUE,
      expect: Number.MIN_VALUE,
    });
  });
  test("Symbol.iterator and Symbol.toPrimitive", () => {
    assert({
      actual: Symbol.iterator,
      expect: Symbol.toPrimitive,
    });
  });
  test(`Symbol.for("a") and Symbol.for("b")`, () => {
    assert({
      actual: Symbol.for("a"),
      expect: Symbol.for("b"),
    });
  });
  test("Object.prototype.toString vs Object.prototype.hasOwnProperty", () => {
    assert({
      actual: Object.prototype.toString,
      expect: Object.prototype.hasOwnProperty,
    });
  });
  test("null and Array.prototype", () => {
    assert({
      actual: null,
      expect: Array.prototype,
    });
  });
});
