/* eslint-disable no-sparse-arrays */
import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";

await startSnapshotTesting("array", ({ test }) => {
  test("array first item diff", () => {
    assert({
      actual: [true],
      expect: [false],
    });
  });
  test("array expect, object received", () => {
    assert({
      actual: {},
      expect: [],
    });
  });
  test("object expect, array received", () => {
    assert({
      actual: [],
      expect: {},
    });
  });
  test("array without diff", () => {
    assert({
      actual: {
        a: [0],
        z: true,
      },
      expect: {
        a: [0],
        z: false,
      },
    });
  });
  test("diff in the middle of big array", () => {
    assert({
      actual: ["a", "b", "c", "Z", "e", "f", "g", "h"],
      expect: ["a", "b", "c", "d", "e", "f", "g", "h"],
    });
  });
  test("big array collapsed because diff is elsewhere", () => {
    assert({
      actual: {
        a: ["a", "b", "c", "d", "e", "f", "g", "h"],
        b: true,
      },
      expect: {
        a: ["a", "b", "c", "d", "e", "f", "g", "h"],
        b: false,
      },
      MAX_COLUMNS: 35,
    });
  });
  test("undefined vs empty", () => {
    assert({
      actual: [,],
      expect: [undefined],
    });
  });
  test("empty added", () => {
    assert({
      actual: [,],
      expect: [],
    });
  });
  test("empty removed", () => {
    assert({
      actual: [],
      expect: [,],
    });
  });
  test("false should be an array", () => {
    assert({
      actual: false,
      expect: [],
    });
  });
  test("associative array expect, object received", () => {
    assert({
      actual: Object.assign([], {
        foo: true,
      }),
      expect: {
        foo: true,
      },
    });
  });
  test("diff on associate array.foo and object.foo", () => {
    assert({
      actual: Object.assign([], {
        foo: true,
      }),
      expect: {
        foo: false,
      },
    });
  });
  test("diff on associate array deep property and object deep property", () => {
    assert({
      actual: Object.assign([], {
        user: { name: "bob" },
      }),
      expect: {
        user: {
          name: "alice",
        },
      },
    });
  });
  test("diff on collapsed array", () => {
    assert({
      actual: {
        a: {
          same: [true],
          a: [false, false],
          r: [],
          ma: [false, true],
          mr: [false],
          m: [false, false],
        },
      },
      expect: {
        a: {
          same: [true],
          a: [],
          r: [true, true, true],
          ma: [true],
          mr: [true],
          m: [true, true],
        },
      },
      MAX_DEPTH_INSIDE_DIFF: 0,
    });
  });
  test("string and array of chars", () => {
    assert({
      actual: "hello world",
      expect: ["h", "e", "l", "l", "o", " ", "w", "o", "r", "l", "d"],
    });
  });
  test("associative array with values", () => {
    assert({
      actual: Object.assign(["a", "b"], {
        user: "bob",
      }),
      expect: Object.assign(["Z", "b"], {
        user: "alice",
      }),
    });
  });
  test("array like and array", () => {
    assert({
      actual: {
        0: "Z",
        1: "b",
        length: 2,
      },
      expect: [
        "a", //
        "b",
      ],
    });
  });
  test("array subclass", () => {
    class MyArray extends Array {}
    assert({
      actual: [true],
      expect: new MyArray(true),
    });
  });
});
