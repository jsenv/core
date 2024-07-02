import { assert } from "@jsenv/assert";
import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";

await startSnapshotTesting("symbol", ({ test }) => {
  test("named Symbol() property added", () => {
    assert({
      actual: {
        [Symbol("foo")]: true,
      },
      expect: {},
    });
  });
  test("named Symbol() property removed", () => {
    assert({
      actual: {},
      expect: {
        [Symbol("foo")]: true,
      },
    });
  });
  test("Symbol.for() property value modified", () => {
    assert({
      actual: {
        [Symbol.for("foo")]: true,
      },
      expect: {
        [Symbol.for("foo")]: false,
      },
    });
  });
  test("Symbol.for() property no diff", () => {
    assert({
      actual: {
        a: true,
        [Symbol.for("foo")]: true,
      },
      expect: {
        a: false,
        [Symbol.for("foo")]: true,
      },
    });
  });
  test("named Symbol() property value modified", () => {
    assert({
      actual: {
        [Symbol("foo")]: true,
      },
      expect: {
        [Symbol("foo")]: false,
      },
    });
  });
  test("named Symbol() property no diff", () => {
    assert({
      actual: {
        a: true,
        [Symbol("foo")]: true,
      },
      expect: {
        a: false,
        [Symbol("foo")]: true,
      },
    });
  });
  test("anonymous Symbol() property value modified", () => {
    assert({
      actual: {
        [Symbol()]: true,
      },
      expect: {
        [Symbol()]: false,
      },
    });
  });
  test("Symbol.iterator property value modified", () => {
    assert({
      actual: {
        [Symbol.iterator]: true,
      },
      expect: {
        [Symbol.iterator]: false,
      },
    });
  });
  test("Symbol.toStringTag property value modified", () => {
    assert({
      actual: {
        [Symbol.toStringTag]: "a",
      },
      expect: {
        [Symbol.toStringTag]: "b",
      },
    });
  });
  test("well known symbol diff", () => {
    assert({
      actual: Symbol.iterator,
      expect: Symbol.toStringTag,
    });
  });
  test("Symbol() description modified", () => {
    assert({
      actual: Symbol("a"),
      expect: Symbol("b"),
    });
  });
  test("Symbol.for() key modified", () => {
    assert({
      actual: Symbol.for("a"),
      expect: Symbol.for("b"),
    });
  });
  test("named Symbol() vs anonymous symbol", () => {
    assert({
      actual: Symbol("a"),
      expect: Symbol(),
    });
  });
  test("anonymous symbol vs named Symbol()", () => {
    assert({
      actual: Symbol(""),
      expect: Symbol("b"),
    });
  });
  test("named Symbol() vs Symbol.for()", () => {
    assert({
      actual: Symbol("a"),
      expect: Symbol.for("a"),
    });
  });
  test("Symbol.for() vs named Symbol()", () => {
    assert({
      actual: Symbol.for("b"),
      expect: Symbol("a"),
    });
  });
  test("symbol diff comes first", () => {
    assert({
      actual: {
        a: true,
        [Symbol.for("a")]: true,
      },
      expect: {
        a: false,
        [Symbol.for("a")]: false,
      },
    });
  });
});
