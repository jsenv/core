import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./start_snapshot_testing.js";

await startSnapshotTesting("error", ({ test }) => {
  test("error message added", () => {
    assert({
      actual: new Error("foo"),
      expect: new Error(),
    });
  });
  test("error message removed", () => {
    assert({
      actual: new Error(),
      expect: new Error("bar"),
    });
  });
  test("error message modified", () => {
    assert({
      actual: new Error("foo"),
      expect: new Error("bar"),
    });
  });
  test("error message vs object with message", () => {
    assert({
      actual: new Error("foo"),
      expect: { message: "foo" },
    });
  });
  test("error stack vs object with stack", () => {
    assert({
      actual: new Error("message"),
      expect: { stack: "stack" },
    });
  });
  test("error message multiline", () => {
    assert({
      actual: new Error(`Hello
world`),
      expect: new Error(`Hello
france`),
    });
  });
  test("error prop added", () => {
    assert({
      actual: Object.assign(new Error("message"), { a: true }),
      expect: new Error("message"),
    });
  });
  test("error prop removed", () => {
    assert({
      actual: new Error("message"),
      expect: Object.assign(new Error("message"), { a: true }),
    });
  });
  test("error prop modified", () => {
    assert({
      actual: Object.assign(new Error("message"), { a: true }),
      expect: Object.assign(new Error("message"), { a: false }),
    });
  });
  test("error vs typeError", () => {
    assert({
      actual: new Error(),
      expect: new TypeError(),
    });
  });
  test("error vs CustomError", () => {
    class ValidationError extends Error {}
    assert({
      actual: new Error(),
      expect: new ValidationError(),
    });
  });
});
