import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("property_descriptor", {
  ["non enumerable hidden when value same"]: () => {
    const actual = { a: true };
    const expected = { a: false };
    Object.defineProperty(actual, "b", {
      enumerable: false,
      value: "b",
    });
    Object.defineProperty(expected, "b", {
      enumerable: false,
      value: "b",
    });
    assert({
      actual,
      expected,
    });
  },
  ["non enumerable displayed when value modified"]: () => {
    const actual = {};
    const expected = {};
    Object.defineProperty(actual, "b", {
      enumerable: false,
      value: "b",
    });
    Object.defineProperty(expected, "b", {
      enumerable: false,
      value: "c",
    });
    assert({
      actual,
      expected,
    });
  },
  ["enumerable diff"]: () => {
    const actual = {};
    const expected = {};
    Object.defineProperty(actual, "a", {
      enumerable: true,
      value: "a",
    });
    Object.defineProperty(expected, "a", {
      enumerable: false,
      value: "a",
    });
    assert({
      actual,
      expected,
    });
  },
  ["enumerable and value diff"]: () => {
    const actual = {};
    const expected = {};
    Object.defineProperty(actual, "a", {
      enumerable: false,
      value: "a",
    });
    Object.defineProperty(expected, "a", {
      enumerable: true,
      value: "b",
    });
    assert({
      actual,
      expected,
    });
  },
  ["enumerable and configurable and value diff"]: () => {
    const actual = {};
    const expected = {};
    Object.defineProperty(actual, "a", {
      enumerable: true,
      configurable: true,
      value: "a",
    });
    Object.defineProperty(expected, "a", {
      enumerable: false,
      configurable: false,
      value: "b",
    });
    assert({
      actual,
      expected,
    });
  },
  ["getter and value"]: () => {
    assert({
      actual: {
        get a() {
          return true;
        },
      },
      expected: {
        a: true,
      },
    });
  },
});
