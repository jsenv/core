import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("string", {
  ["string single char"]: () => {
    assert({
      actual: "a",
      expected: "b",
    });
  },
  ["diff end of string"]: () => {
    assert({
      actual: "hello world",
      expected: "hello france",
    });
  },
  ["one char should be empty"]: () => {
    assert({
      actual: "a",
      expected: "",
    });
  },
  ["empty should be one char"]: () => {
    assert({
      actual: "",
      expected: "a",
    });
  },
  ["tab vs space"]: () => {
    assert({
      actual: "	",
      expected: "  ",
    });
  },
  ["blank char should be empty"]: () => {
    assert({
      actual: String.fromCharCode(127),
      expected: "",
    });
  },
  ["diff unicode"]: () => {
    assert({
      actual: "⚫️",
      expected: "⚪️",
    });
  },
  ["diff emoticon"]: () => {
    assert({
      actual: "👨‍👩‍👧‍👧",
      expected: "😍",
    });
  },
  ["diff special char"]: () => {
    assert({
      actual: "ñ",
      expected: "n",
    });
  },
  ["added char"]: () => {
    assert({
      actual: "ab",
      expected: "a",
    });
  },
  ["removed char"]: () => {
    assert({
      actual: "a",
      expected: "ab",
    });
  },
  ["diff at end of long string, start truncated"]: () => {
    assert({
      actual: "abcdefghijk",
      expected: "abcdefghijj",
      maxColumns: 18,
    });
  },
  ["diff at start of long string, end truncated"]: () => {
    assert({
      actual: "a2cdefghijk",
      expected: "a3cdefghijk",
      maxColumns: 18,
    });
  },
  ["many diff in long string, only first is shown truncated"]: () => {
    assert({
      actual: "a2cdefZZZghijk",
      expected: "a3cdefYYYghijk",
      maxColumns: 18,
    });
  },
  ["diff at middle of long string, start + end truncated"]: () => {
    assert({
      actual: "abcdefgh5jklmnopqrstu",
      expected: "abcdefgh6jklmnopqrstu",
      maxColumns: 15,
    });
  },
  /* eslint-disable no-new-wrappers */
  ["diff new String value"]: () => {
    assert({
      actual: new String("a"),
      expected: new String("b"),
    });
  },
  /* eslint-enable no-new-wrappers */
  /* eslint-disable no-new-wrappers */
  ["diff String object vs literal"]: () => {
    assert({
      actual: new String("abc"),
      expected: "a2",
    });
  },
  /* eslint-enable no-new-wrappers */
  /* eslint-disable no-new-wrappers */
  ["new String collapsed with overview"]: () => {
    assert({
      actual: {
        a: new String("toto"),
        b: true,
      },
      expected: {
        a: new String("toto"),
        b: false,
      },
    });
  },
  /* eslint-enable no-new-wrappers */
  /* eslint-disable no-new-wrappers */
  ["new String collapsed"]: () => {
    assert({
      actual: {
        foo: {
          a: new String("toto"),
        },
      },
      expected: {
        bar: {
          a: new String("toto"),
        },
      },
      maxDepthInsideDiff: 0,
    });
  },
  /* eslint-enable no-new-wrappers */
  /* eslint-disable no-new-wrappers */
  ["new String prop"]: () => {
    assert({
      actual: Object.assign(new String("toto"), { foo: "a" }),
      expected: Object.assign(new String("tata"), { foo: "b" }),
    });
  },
  /* eslint-enable no-new-wrappers */
  ["second line contains extra chars"]: () => {
    assert({
      actual: {
        foo: `Hello,
my name is Benjamin
and my brother is joe`,
      },
      expected: {
        foo: `Hello,
my name is Ben
and my brother is joe`,
      },
    });
  },
  ["one line vs two lines"]: () => {
    assert({
      actual: "Hel",
      expected: `Hello
world`,
    });
  },
  ["second line differs"]: () => {
    assert({
      actual: `Hello
world`,
      expected: `Hello
france`,
    });
  },
  ["too many lines before and after"]: () => {
    assert({
      actual: `one
two
three
four/true
five
six
seven/0`,
      expected: `one
two
three
four/false
five
six
seven/1`,
    });
  },
  // - add a new empty line
  // - remove a line
});
