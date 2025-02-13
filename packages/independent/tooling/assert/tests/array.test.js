/* eslint-disable no-sparse-arrays */
import { assert } from "@jsenv/assert";
import { snapshotAssertTests } from "@jsenv/assert/tests/snapshot_assert.js";

await snapshotAssertTests(import.meta.url, ({ test }) => {
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
      MAX_DIFF: 6,
      MAX_DIFF_PER_VALUE: 6,
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
  test("added on third pos", () => {
    assert({
      actual: ["a", "b"],
      expect: ["a", "b", "Z"],
    });
  });
  test("added on fifth pos", () => {
    assert({
      actual: ["a", "b", "c", "d"],
      expect: ["a", "b", "c", "d", "Z"],
    });
  });
  test("2 added on fifth pos", () => {
    assert({
      actual: ["a", "b", "c", "d"],
      expect: ["a", "b", "c", "d", "Z1", "Z2"],
    });
  });
  test("3 added on fifth pos", () => {
    assert({
      actual: ["a", "b", "c", "d"],
      expect: ["a", "b", "c", "d", "Z1", "Z2", "Z3"],
    });
  });
  test("lot added on fifth pos", () => {
    assert({
      actual: ["a", "b", "c", "d"],
      expect: ["a", "b", "c", "d", "Z1", "Z2", "Z3", "Z4", "Z5"],
    });
  });
});
