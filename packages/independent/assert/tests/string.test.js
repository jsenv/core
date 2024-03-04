import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("string", {
  // ["string single char"]: () => {
  //   assert({
  //     actual: "a",
  //     expected: "b",
  //   });
  // },
  // ["diff end of string"]: () => {
  //   assert({
  //     actual: "hello world",
  //     expected: "hello france",
  //   });
  // },
  // ["one char should be empty"]: () => {
  //   assert({
  //     actual: "a",
  //     expected: "",
  //   });
  // },
  // ["empty should be one char"]: () => {
  //   assert({
  //     actual: "",
  //     expected: "a",
  //   });
  // },
  // ["tab vs space"]: () => {
  //   assert({
  //     actual: "	",
  //     expected: "  ",
  //   });
  // },
  // ["blank char should be empty"]: () => {
  //   assert({
  //     actual: String.fromCharCode(127),
  //     expected: "",
  //   });
  // },
  // ["diff unicode"]: () => {
  //   assert({
  //     actual: "⚫️",
  //     expected: "⚪️",
  //   });
  // },
  // ["diff emoticon"]: () => {
  //   assert({
  //     actual: "👨‍👩‍👧‍👧",
  //     expected: "😍",
  //   });
  // },
  // ["diff special char"]: () => {
  //   assert({
  //     actual: "ñ",
  //     expected: "n",
  //   });
  // },
  // ["added char"]: () => {
  //   assert({
  //     actual: "ab",
  //     expected: "a",
  //   });
  // },
  // ["removed char"]: () => {
  //   assert({
  //     actual: "a",
  //     expected: "ab",
  //   });
  // },
  // ["diff at end of long string, start truncated"]: () => {
  //   assert({
  //     actual: "abcdefghijk",
  //     expected: "abcdefghijj",
  //     maxColumns: 18,
  //   });
  // },
  // ["diff at start of long string, end truncated"]: () => {
  //   assert({
  //     actual: "a2cdefghijk",
  //     expected: "a3cdefghijk",
  //     maxColumns: 18,
  //   });
  // },
  // ["many diff in long string, only first is shown truncated"]: () => {
  //   assert({
  //     actual: "a2cdefZZZghijk",
  //     expected: "a3cdefYYYghijk",
  //     maxColumns: 18,
  //   });
  // },
  // ["diff at middle of long string, start + end truncated"]: () => {
  //   assert({
  //     actual: "abcdefgh5jklmnopqrstu",
  //     expected: "abcdefgh6jklmnopqrstu",
  //     maxColumns: 15,
  //   });
  // },
  // ["diff new String value"]: () => {
  //   assert({
  //     // eslint-disable-next-line no-new-wrappers
  //     actual: new String("a"),
  //     // eslint-disable-next-line no-new-wrappers
  //     expected: new String("b"),
  //   });
  // },
  ["diff String object vs literal"]: () => {
    assert({
      // eslint-disable-next-line no-new-wrappers
      actual: new String("a"),
      expected: "a",
    });
  },
  // TODO LATER:
  // - comparing single line / multiline
  // - compare multiline
  // - add a new empty line
  // - remove a line
});
