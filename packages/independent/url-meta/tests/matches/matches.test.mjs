import { assert } from "@jsenv/assert";

import { URL_META } from "@jsenv/url-meta";

{
  const test = (file, expect) => {
    const actual = URL_META.matches(file, {
      "file:///**/node_modules/@jsenv/core/": true,
    });
    assert({ actual, expect });
  };

  test("file:///project/node_modules/@jsenv/core/src/toto.js", true);
  test("file:///project/@jsenv/core/src/toto.js", false);
}
