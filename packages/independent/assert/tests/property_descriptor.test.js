/* eslint-disable accessor-pairs */
import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";

await startSnapshotTesting("property_descriptor", ({ test }) => {
  test("enumerable and configurable and value diff", () => {
    assert({
      actual: Object.defineProperty({}, "a", {
        enumerable: true,
        configurable: true,
        value: "a",
      }),
      expect: Object.defineProperty({}, "a", {
        enumerable: false,
        configurable: false,
        value: "b",
      }),
    });
  });
  test("non enumerable hidden when value same", () => {
    assert({
      actual: Object.defineProperty({ a: true }, "b", {
        enumerable: false,
        value: "b",
      }),
      expect: Object.defineProperty({ a: false }, "b", {
        enumerable: false,
        value: "b",
      }),
    });
  });
  test("non enumerable displayed when value modified", () => {
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
  });
  test("enumerable diff", () => {
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
  });
  test("enumerable and value diff", () => {
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
  });
  test("getter and value", () => {
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
  });
  test("getter/setter and value", () => {
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
  });
  test("getter only and setter only", () => {
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
  });
  test("setter only and getter only", () => {
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
  });
  test("getter source code same", () => {
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
  });
  test("getter source code diff", () => {
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
  });
});
