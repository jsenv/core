// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse#non-standard_date_strings
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format

import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("regexp", {
  ["a vs b"]: () => {
    assert({
      actual: /a/,
      expect: /b/,
    });
  },
  ["i flag vs no flag"]: () => {
    assert({
      actual: /a/i,
      expect: /a/,
    });
  },
  ["gi flag vs ig flag"]: () => {
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
  },
  ["special char: parenthesis vs dot"]: () => {
    assert({
      actual: /^\($/g,
      expect: /^\.$/g,
    });
  },
  ["last index"]: () => {
    const actual = /a/;
    const expect = /a/;
    expect.lastIndex = 10;
    assert({
      actual,
      expect,
    });
  },
  ["regex and string representing the same regex"]: () => {
    assert({
      actual: /a/,
      expect: "/a/",
    });
  },
});
