import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("string", {
  ["string single char"]: () => {
    assert({
      actual: "a",
      expect: "b",
    });
  },
  ["diff end of string"]: () => {
    assert({
      actual: "hello world",
      expect: "hello france",
    });
  },
  ["one char should be empty"]: () => {
    assert({
      actual: "a",
      expect: "",
    });
  },
  ["empty should be one char"]: () => {
    assert({
      actual: "",
      expect: "a",
    });
  },
  ["tab vs space"]: () => {
    assert({
      actual: "	",
      expect: "  ",
    });
  },
  ["blank char should be empty"]: () => {
    assert({
      actual: String.fromCharCode(127),
      expect: "",
    });
  },
  ["diff unicode"]: () => {
    assert({
      actual: "⚫️",
      expect: "⚪️",
    });
  },
  ["diff emoticon"]: () => {
    assert({
      actual: "👨‍👩‍👧‍👧",
      expect: "😍",
    });
  },
  ["diff special char"]: () => {
    assert({
      actual: "ñ",
      expect: "n",
    });
  },
  ["added char"]: () => {
    assert({
      actual: "ab",
      expect: "a",
    });
  },
  ["removed char"]: () => {
    assert({
      actual: "a",
      expect: "ab",
    });
  },
  ["diff at end of long string, start truncated"]: () => {
    assert({
      actual: "abcdefghijk",
      expect: "abcdefghijj",
      maxColumns: 18,
    });
  },
  ["diff at start of long string, end truncated"]: () => {
    assert({
      actual: "a2cdefghijk",
      expect: "a3cdefghijk",
      maxColumns: 18,
    });
  },
  ["many diff in long string, only first is shown truncated"]: () => {
    assert({
      actual: "a2cdefZZZghijk",
      expect: "a3cdefYYYghijk",
      maxColumns: 18,
    });
  },
  ["diff at middle of long string, start + end truncated"]: () => {
    assert({
      actual: "abcdefgh5jklmnopqrstu",
      expect: "abcdefgh6jklmnopqrstu",
      maxColumns: 15,
    });
  },
  ["single quote best in actual"]: () => {
    assert({
      actual: `My name is "dam"`,
      expect: `My name is ZdamZ`,
    });
  },
  ["single quote best in expect"]: () => {
    assert({
      actual: `My name is ZdamZ`,
      expect: `My name is "dam"`,
    });
  },
  ["template quote best in expect"]: () => {
    assert({
      actual: `I'm "zac"`,
      expect: `I'm "dam"`,
    });
  },
  ["double best and must be escaped"]: () => {
    assert({
      actual: `START "dam" \`''' END`,
      expect: `START "zac" \`''' END`,
    });
  },
  ["second line contains extra chars"]: () => {
    assert({
      actual: {
        foo: `Hello,
my name is Benjamin
and my brother is joe`,
      },
      expect: {
        foo: `Hello,
my name is Ben
and my brother is joe`,
      },
    });
  },
  ["add empty line"]: () => {
    assert({
      actual: `\n`,
      expect: ``,
    });
  },
  ["remove empty line"]: () => {
    assert({
      actual: ``,
      expect: `\n`,
    });
  },
  ["one line vs two lines"]: () => {
    assert({
      actual: "Hel",
      expect: `Hello
world`,
    });
  },
  ["second line differs"]: () => {
    assert({
      actual: `Hello
world`,
      expect: `Hello
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
      expect: `one
two
three
four/false
five
six
seven/1`,
    });
  },
  ["many lines added"]: () => {
    assert({
      actual: `one
two
three
four
five six`,
      expect: `one`,
    });
  },
  ["many lines removed"]: () => {
    assert({
      actual: `one`,
      expect: `one
two
three
four
five six`,
    });
  },
});
