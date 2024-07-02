// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse#non-standard_date_strings
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format

import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";

await startSnapshotTesting("regexp", ({ test }) => {
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
