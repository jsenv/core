import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./start_snapshot_testing.js";

await startSnapshotTesting("string", ({ test }) => {
  test("string single char", () => {
    assert({
      actual: "a",
      expect: "b",
    });
  });
  test("diff end of string", () => {
    assert({
      actual: "hello world",
      expect: "hello france",
    });
  });
  test("one char should be empty", () => {
    assert({
      actual: "a",
      expect: "",
    });
  });

  test("empty should be one char", () => {
    assert({
      actual: "",
      expect: "a",
    });
  });

  test("tab vs space", () => {
    assert({
      actual: "	",
      expect: "  ",
    });
  });
  test("blank char should be empty", () => {
    assert({
      actual: String.fromCharCode(127),
      expect: "",
    });
  });
  test("diff unicode", () => {
    assert({
      actual: "⚫️",
      expect: "⚪️",
    });
  });
  test("diff emoticon", () => {
    assert({
      actual: "👨‍👩‍👧‍👧",
      expect: "😍",
    });
  });
  test("diff special char", () => {
    assert({
      actual: "ñ",
      expect: "n",
    });
  });
  test("added char", () => {
    assert({
      actual: "ab",
      expect: "a",
    });
  });
  test("removed char", () => {
    assert({
      actual: "a",
      expect: "ab",
    });
  });
  test("diff at end of long string, start truncated", () => {
    assert({
      actual: "abcdefghijk",
      expect: "abcdefghijj",
      MAX_COLUMNS: 18,
    });
  });
  test("diff at start of long string, end truncated", () => {
    assert({
      actual: "a2cdefghijk",
      expect: "a3cdefghijk",
      MAX_COLUMNS: 18,
    });
  });
  test("many diff in long string, only first is shown truncated", () => {
    assert({
      actual: "a2cdefZZZghijk",
      expect: "a3cdefYYYghijk",
      MAX_COLUMNS: 18,
    });
  });
  test("diff at middle of long string, start + end truncated", () => {
    assert({
      actual: "abcdefgh5jklmnopqrstu",
      expect: "abcdefgh6jklmnopqrstu",
      MAX_COLUMNS: 15,
    });
  });
  /* eslint-disable no-new-wrappers */
  test("diff new String value", () => {
    assert({
      actual: new String("a"),
      expect: new String("b"),
    });
  });
  test("diff String object vs literal", () => {
    assert({
      actual: new String("abc"),
      expect: "a2",
    });
  });
  test("new String collapsed with overview", () => {
    assert({
      actual: {
        a: new String("toto"),
        b: true,
      },
      expect: {
        a: new String("toto"),
        b: false,
      },
    });
  });
  test("new String collapsed", () => {
    assert({
      actual: {
        foo: {
          a: new String("toto"),
        },
      },
      expect: {
        bar: {
          a: new String("toto"),
        },
      },
      MAX_DEPTH_INSIDE_DIFF: 1,
    });
  });
  test("new String prop", () => {
    assert({
      actual: Object.assign(new String("a"), { foo: true }),
      expect: Object.assign(new String("b"), { foo: false }),
    });
  });
});
