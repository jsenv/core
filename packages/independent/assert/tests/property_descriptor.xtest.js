/* eslint-disable accessor-pairs */
import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("property_descriptor", {
  ["non enumerable hidden when value same"]: () => {
    const actual = { a: true };
    const expect = { a: false };
    Object.defineProperty(actual, "b", {
      enumerable: false,
      value: "b",
    });
    Object.defineProperty(expect, "b", {
      enumerable: false,
      value: "b",
    });
    assert({
      actual,
      expect,
    });
  },
  ["non enumerable displayed when value modified"]: () => {
    const actual = {};
    const expect = {};
    Object.defineProperty(actual, "b", {
      enumerable: false,
      value: "b",
    });
    Object.defineProperty(expect, "b", {
      enumerable: false,
      value: "c",
    });
    assert({
      actual,
      expect,
    });
  },
  ["enumerable diff"]: () => {
    const actual = {};
    const expect = {};
    Object.defineProperty(actual, "a", {
      enumerable: true,
      value: "a",
    });
    Object.defineProperty(expect, "a", {
      enumerable: false,
      value: "a",
    });
    assert({
      actual,
      expect,
    });
  },
  ["enumerable and value diff"]: () => {
    const actual = {};
    const expect = {};
    Object.defineProperty(actual, "a", {
      enumerable: false,
      value: "a",
    });
    Object.defineProperty(expect, "a", {
      enumerable: true,
      value: "b",
    });
    assert({
      actual,
      expect,
    });
  },
  ["enumerable and configurable and value diff"]: () => {
    const actual = {};
    const expect = {};
    Object.defineProperty(actual, "a", {
      enumerable: true,
      configurable: true,
      value: "a",
    });
    Object.defineProperty(expect, "a", {
      enumerable: false,
      configurable: false,
      value: "b",
    });
    assert({
      actual,
      expect,
    });
  },
  ["getter and value"]: () => {
    assert({
      actual: {
        get a() {
          return true;
        },
      },
      expect: {
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
      expect: {
        a: true,
      },
    });
  },
  ["getter only and setter only"]: () => {
    assert({
      actual: {
        get a() {
          return true;
        },
      },
      expect: {
        set a(v) {},
      },
    });
  },
  ["setter only and getter only"]: () => {
    assert({
      actual: {
        set a(v) {},
      },
      expect: {
        get a() {
          return true;
        },
      },
    });
  },
  ["getter source code same"]: () => {
    assert({
      actual: {
        get a() {
          return true;
        },
        b: true,
      },
      expect: {
        get a() {
          return true;
        },
        b: false,
      },
    });
  },
  ["getter source code diff"]: () => {
    assert({
      actual: {
        get a() {
          return false;
        },
      },
      expect: {
        get a() {
          return true;
        },
      },
    });
  },
});
