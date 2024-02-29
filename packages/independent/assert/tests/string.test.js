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
  // TODO:
  // - diff at beginning of long string, end is truncated
  // - diff on the middle of big string and goes to the end but too long so it's truncated
  // - diff on the end of a long string, the beginning is truncated
  //   so that we can see the diff that is at the end
  // TODO LATER:
  // - comparing single line / multiline
  // - compare multiline
  // - add a new empty line
  // - remove a line
});
