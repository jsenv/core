// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse#non-standard_date_strings
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format

import { assert } from "@jsenv/assert";
import { snapshotAssertTests } from "@jsenv/assert/tests/snapshot_assert.js";

await snapshotAssertTests(import.meta.url, ({ test }) => {
  test("a vs b", () => {
    assert({
      actual: /a/,
      expect: /b/,
    });
  });
  test("i flag vs no flag", () => {
    assert({
      actual: /a/i,
      expect: /a/,
    });
  });
  /* eslint-disable regexp/sort-flags */
  test("gi flag vs ig flag", () => {
    assert({
      actual: {
        a: /a/gi,
        b: true,
      },
      expect: {
        // prettier-ignore
        a: /a/ig,
        b: false,
      },
    });
  });
  /* eslint-enable regexp/sort-flags */
  test("special char: parenthesis vs dot", () => {
    assert({
      actual: /^\($/g,
      expect: /^\.$/g,
    });
  });
  test("last index", () => {
    const actual = /a/;
    const expect = /a/;
    expect.lastIndex = 10;
    assert({
      actual,
      expect,
    });
  });
  test("regex and string representing the same regex", () => {
    assert({
      actual: /a/,
      expect: "/a/",
    });
  });
});
