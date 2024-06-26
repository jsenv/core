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
  for (const MAX_COLUMNS of [9, 10, 11, 12, 13, 19, 20]) {
    test(`on string at ${MAX_COLUMNS}`, () => {
      assert({
        actual: "abcdefghij",
        expect: "ABCDEFGHIJ",
        MAX_COLUMNS,
      });
    });
  }
  for (const MAX_COLUMNS of [10, 11, 12, 13, 14, 15]) {
    test(`on property at ${MAX_COLUMNS}`, () => {
      assert({
        actual: {
          abcdefgh: true,
        },
        expect: {
          abcdefgh: false,
        },
        MAX_COLUMNS,
      });
    });
  }
  test("on property at 15 and value width is 1", () => {
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
  test("on middle of property key", () => {
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
  // Multiline
  test("lines around start partially truncated", () => {
    assert({
      actual: `
123456789
abcdefghijkl`,
      expect: `
123456789
abcdefghZjkl`,
      MAX_COLUMNS: 16,
    });
  });
  test("lines around start fully truncated", () => {
    assert({
      actual: `
1
abcd`,
      expect: `
1
abcZ`,
      MAX_COLUMNS: 14,
    });
  });
  test("lines around start fully truncated 2", () => {
    assert({
      actual: `
1
abcdefgh`,
      expect: `
1
abcdeZgh`,
      MAX_COLUMNS: 16,
    });
  });
  test("lines around end is truncated", () => {
    assert({
      actual: `
123456789
abcdef
1234567`,
      expect: `
123456789
Zbcdef
123456789`,
      MAX_COLUMNS: 15,
    });
  });
  test("lines around end is truncated 2", () => {
    assert({
      actual: `
123456789
abcdefghi
123456789`,
      expect: `
123456789
abcdZfghi
123456789`,
      MAX_COLUMNS: 18,
    });
  });
  for (const MAX_COLUMNS of [20, 21, 22, 23, 24, 25, 26]) {
    test(`on array at ${MAX_COLUMNS}`, () => {
      // expecting to go through the following phases
      // but not as soon as columns+1 as some steps require 2 more chars to be displayed
      // 1. "abcdefghijklmno,"
      // 2. "abcdefghijklmno: …,"
      // 3. "abcdefghijklmno: […],"
      // 4. "abcdefghijklmno: [0, …],"
      assert({
        actual: {
          abcdefghijklmno: [0, 1, 2],
          z: true,
        },
        expect: {
          abcdefghijklmno: [0, 1, 2],
          z: false,
        },
        MAX_COLUMNS,
      });
    });
  }
});
