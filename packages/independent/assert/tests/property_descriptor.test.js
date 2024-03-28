/* eslint-disable accessor-pairs */
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
  ["getter/setter and value"]: () => {
    assert({
      actual: {
        get a() {
          return true;
        },
        set a(v) {},
      },
      expected: {
        a: true,
      },
    });
  },
  ["getter and no getter"]: () => {
    assert({
      actual: {
        get a() {
          return true;
        },
      },
      expected: {
        set a(v) {},
      },
    });
  },
  ["setter and no setter"]: () => {
    assert({
      actual: {
        set a(v) {},
      },
      expected: {
        get a() {
          return true;
        },
      },
    });
  },
  ["getter are the same"]: () => {
    assert({
      actual: {
        get a() {
          return true;
        },
        b: true,
      },
      expected: {
        get a() {
          return true;
        },
        b: false,
      },
    });
  },
  ["getter are different"]: () => {
    assert({
      actual: {
        get a() {
          return false;
        },
      },
      expected: {
        get a() {
          return true;
        },
      },
    });
  },
});
