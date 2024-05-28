/*
 * things to keep in mind
 * - Object.isFrozen(Object.seal({})) -> true
 * - Object.isFrozen(Object.preventExtensions({})) -> true
 */
import { startSnapshotTesting } from "./start_snapshot_testing.js";
import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("object_integrity", {
  ["frozen vs not frozen"]: () => {
    assert({
      actual: Object.freeze({ a: true }),
      expect: { a: true },
    });
  },
  ["not frozen vs frozen"]: () => {
    assert({
      actual: { a: true },
      expect: Object.freeze({ a: true }),
    });
  },
  ["sealed vs not sealed"]: () => {
    assert({
      actual: Object.seal({ a: true }),
      expect: { a: true },
    });
  },
  ["not sealed vs sealed"]: () => {
    assert({
      actual: { a: true },
      expect: Object.seal({ a: true }),
    });
  },
  ["frozen vs sealed"]: () => {
    assert({
      actual: Object.freeze({ a: true }),
      expect: Object.seal({ a: true }),
    });
  },
  ["sealed vs frozen"]: () => {
    assert({
      actual: Object.seal({ a: true }),
      expect: Object.freeze({ a: true }),
    });
  },
  ["extensible vs non extensible"]: () => {
    assert({
      actual: { a: true },
      expect: Object.preventExtensions({ a: true }),
    });
  },
  ["non extensible vs extensible"]: () => {
    assert({
      actual: Object.preventExtensions({ a: true }),
      expect: { a: true },
    });
  },
  ["sealed vs non extensible"]: () => {
    assert({
      actual: Object.seal({ a: true }),
      expect: Object.preventExtensions({ a: true }),
    });
  },
  ["non extensible vs frozen"]: () => {
    assert({
      actual: Object.preventExtensions({ a: true }),
      expect: Object.freeze({ a: true }),
    });
  },
  ["frozen array vs frozen function"]: () => {
    assert({
      actual: Object.freeze(["a"]),
      expect: Object.freeze(() => {}),
    });
  },
  ["both sealed, diff is elsewhere"]: () => {
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
  },
});
