import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("error", {
  ["error message added"]: () => {
    assert({
      actual: new Error("foo"),
      expect: new Error(),
    });
  },
  ["error message removed"]: () => {
    assert({
      actual: new Error(),
      expect: new Error("bar"),
    });
  },
  ["error message modified"]: () => {
    assert({
      actual: new Error("foo"),
      expect: new Error("bar"),
    });
  },
  ["error message vs object with message"]: () => {
    assert({
      actual: new Error("foo"),
      expect: { message: "foo" },
    });
  },
  ["error stack vs object with stack"]: () => {
    assert({
      actual: new Error("message"),
      expect: { stack: "stack" },
    });
  },
  ["error message multiline"]: () => {
    assert({
      actual: new Error(`Hello
world`),
      expect: new Error(`Hello
france`),
    });
  },
  ["error prop added"]: () => {
    assert({
      actual: Object.assign(new Error("message"), { a: true }),
      expect: new Error("message"),
    });
  },
  ["error prop removed"]: () => {
    assert({
      actual: new Error("message"),
      expect: Object.assign(new Error("message"), { a: true }),
    });
  },
  ["error prop modified"]: () => {
    assert({
      actual: Object.assign(new Error("message"), { a: true }),
      expect: Object.assign(new Error("message"), { a: false }),
    });
  },
  ["error vs typeError"]: () => {
    assert({
      actual: new Error(),
      expect: new TypeError(),
    });
  },
  ["error vs CustomError"]: () => {
    class ValidationError extends Error {}
    assert({
      actual: new Error(),
      expect: new ValidationError(),
    });
  },
});
