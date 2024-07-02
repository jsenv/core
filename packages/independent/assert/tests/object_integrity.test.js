/*
 * things to keep in mind
 * - Object.isFrozen(Object.seal({})) -> true
 * - Object.isFrozen(Object.preventExtensions({})) -> true
 */
import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";

await startSnapshotTesting("object_integrity", ({ test }) => {
  test("frozen vs not frozen", () => {
    assert({
      actual: Object.freeze({ a: true }),
      expect: { a: true },
    });
  });
  test("not frozen vs frozen", () => {
    assert({
      actual: { a: true },
      expect: Object.freeze({ a: true }),
    });
  });
  test("sealed vs not sealed", () => {
    assert({
      actual: Object.seal({ a: true }),
      expect: { a: true },
    });
  });
  test("not sealed vs sealed", () => {
    assert({
      actual: { a: true },
      expect: Object.seal({ a: true }),
    });
  });
  test("frozen vs sealed", () => {
    assert({
      actual: Object.freeze({ a: true }),
      expect: Object.seal({ a: true }),
    });
  });
  test("sealed vs frozen", () => {
    assert({
      actual: Object.seal({ a: true }),
      expect: Object.freeze({ a: true }),
    });
  });
  test("extensible vs non extensible", () => {
    assert({
      actual: { a: true },
      expect: Object.preventExtensions({ a: true }),
    });
  });
  test("non extensible vs extensible", () => {
    assert({
      actual: Object.preventExtensions({ a: true }),
      expect: { a: true },
    });
  });
  test("sealed vs non extensible", () => {
    assert({
      actual: Object.seal({ a: true }),
      expect: Object.preventExtensions({ a: true }),
    });
  });
  test("non extensible vs frozen", () => {
    assert({
      actual: Object.preventExtensions({ a: true }),
      expect: Object.freeze({ a: true }),
    });
  });
  test("frozen array vs frozen function", () => {
    assert({
      actual: Object.freeze(["a"]),
      expect: Object.freeze(() => {}),
    });
  });
  test("both sealed, diff is elsewhere", () => {
    assert({
      actual: {
        a: Object.freeze({ a: true }),
        b: true,
      },
      expect: {
        a: Object.freeze({ a: true }),
        b: false,
      },
    });
  });
});
