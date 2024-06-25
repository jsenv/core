import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./start_snapshot_testing.js";

// TODO: at property when rendered on single line
await startSnapshotTesting("max_columns", ({ test }) => {
  test("at removed char", () => {
    assert({
      actual: "str",
      expect: "str_123456789",
      MAX_COLUMNS: 15,
    });
  });
  test("at added char", () => {
    assert({
      actual: "str_123456789",
      expect: "str",
      MAX_COLUMNS: 15,
    });
  });
  test("at removed char 2", () => {
    assert({
      actual: "a_long_string",
      expect: "a_long_string_123456789",
      MAX_COLUMNS: 30,
    });
  });
  test("at added char 2", () => {
    assert({
      actual: "a_long_string_123456789",
      expect: "a_long_string",
      MAX_COLUMNS: 30,
    });
  });
  test("at removed char 3", () => {
    assert({
      actual: "a_long_string",
      expect: "a_long_string_123456789",
      MAX_COLUMNS: 22,
    });
  });
  test("at added char 3", () => {
    assert({
      actual: "a_long_string_123456789",
      expect: "a_long_string",
      MAX_COLUMNS: 22,
    });
  });
  test("string open quote", () => {
    assert({
      actual: "abcdefghij",
      expect: "ABCDEFGHIJ",
      MAX_COLUMNS: 9,
    });
  });
  test("string first char", () => {
    assert({
      actual: "abcdefghij",
      expect: "ABCDEFGHIJ",
      MAX_COLUMNS: 10,
    });
  });
  test("string second char", () => {
    assert({
      actual: "abcdefghij",
      expect: "ABCDEFGHIJ",
      MAX_COLUMNS: 11,
    });
  });
  test("string third char", () => {
    assert({
      actual: "abcdefghij",
      expect: "ABCDEFGHIJ",
      MAX_COLUMNS: 12,
    });
  });
  test("string fourth char", () => {
    assert({
      actual: "abcdefghij",
      expect: "ABCDEFGHIJ",
      MAX_COLUMNS: 13,
    });
  });
  test("string last char", () => {
    assert({
      actual: "abcdefghij",
      expect: "ABCDEFGHIJ",
      MAX_COLUMNS: 19,
    });
  });
  test("string close quote", () => {
    assert({
      actual: "abcdefghij",
      expect: "ABCDEFGHIJ",
      MAX_COLUMNS: 20,
    });
  });
  test("at property value", () => {
    assert({
      actual: {
        zzz: "abcdefghijklmn",
      },
      expect: {
        zzz: "ABCDEFGHIJKLMN",
      },
      MAX_COLUMNS: 20,
    });
  });
  test("at property key", () => {
    assert({
      actual: {
        "a quite long property key that will be truncated": true,
      },
      expect: {
        "a quite long property key that will be truncated": false,
      },
      MAX_COLUMNS: 40,
    });
  });
  test("at property name last char", () => {
    assert({
      actual: {
        abcdefgh: true,
      },
      expect: {
        abcdefgh: false,
      },
      MAX_COLUMNS: 10,
    });
  });
  test("at property name separator", () => {
    assert({
      actual: {
        abcdefgh: true,
      },
      expect: {
        abcdefgh: false,
      },
      MAX_COLUMNS: 11,
    });
  });
  test("at space after property name separator", () => {
    assert({
      actual: {
        abcdefgh: true,
      },
      expect: {
        abcdefgh: false,
      },
      MAX_COLUMNS: 12,
    });
  });
  test("at property value first char", () => {
    assert({
      actual: {
        abcdefgh: true,
      },
      expect: {
        abcdefgh: false,
      },
      MAX_COLUMNS: 13,
    });
  });
  test("at property value second char", () => {
    assert({
      actual: {
        abcdefgh: true,
      },
      expect: {
        abcdefgh: false,
      },
      MAX_COLUMNS: 14,
    });
  });
  test("at property value second char (and value width is 1)", () => {
    assert({
      actual: {
        abcdefgh: 0,
      },
      expect: {
        abcdefgh: 1,
      },
      MAX_COLUMNS: 14,
    });
  });
  test("at property value third char", () => {
    assert({
      actual: {
        abcdefgh: true,
      },
      expect: {
        abcdefgh: false,
      },
      MAX_COLUMNS: 15,
    });
  });
  test("max column exactly on diff", () => {
    assert({
      actual: `abc`,
      expect: `abC`,
      MAX_COLUMNS: 12,
    });
  });
  // on URLS
  test("double slash and truncate line", () => {
    assert({
      actual: `file:///dmail/documents/dev/jsenv-core/node_modules/@jsenv/assert/src/internal/something.js`,
      expect: `file:///dmail/documents/dev/jsenv-core/node_modules/@jsenv/assert/src/internal//something.js`,
      MAX_COLUMNS: 50,
    });
  });
  test("url search param modified, middle of long params", () => {
    assert({
      actual: "http://example_that_is_long.com?this_is_relatively_long=1&foo=a",
      expect: "http://example_that_is_long.com?this_is_relatively_long=1&foo=b",
      MAX_COLUMNS: 30,
    });
  });
  test("long url diff at end", () => {
    assert({
      actual: "http://example_that_is_quite_long.com/dir/file.txt",
      expect: "http://example_that_is_quite_long.com/dir/file.css",
      MAX_COLUMNS: 40,
    });
  });
  test("long url diff at start", () => {
    assert({
      actual: "http://example_that_is_quite_long.com/dir/file.txt",
      expect: "file://example_that_is_quite_long.com/dir/file.txt",
      MAX_COLUMNS: 40,
    });
  });
  test("long url diff in the middle", () => {
    assert({
      actual: "http://example_that_is_quite_long.com/dir/file.txt",
      expect: "http://example_that_AA_quite_long.com/dir/file.txt",
      MAX_COLUMNS: 40,
    });
  });
  test("long url diff start middle end", () => {
    assert({
      actual: "http://example_that_is_quite_long.com/dir/file.txt",
      expect: "file://example_that_AA_quite_long.com/dir/file.css",
      MAX_COLUMNS: 40,
    });
  });
});
