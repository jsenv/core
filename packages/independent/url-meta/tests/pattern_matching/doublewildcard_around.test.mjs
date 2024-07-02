import { assert } from "@jsenv/assert";

import { URL_META } from "@jsenv/url-meta";

{
  const pattern = "file:///**/a/**/";
  const url = "file:///a";
  const actual = URL_META.applyPatternMatching({ pattern, url });
  const expect = {
    matched: false,
    patternIndex: pattern.lastIndexOf("/**/"),
    urlIndex: url.length,
    matchGroups: [],
  };
  assert({ actual, expect });
}

{
  const pattern = "file:///**/a/**/";
  const url = "file:///a/b/c.js";
  const actual = URL_META.applyPatternMatching({ pattern, url });
  const expect = {
    matched: true,
    patternIndex: pattern.length,
    urlIndex: url.length,
    matchGroups: [],
  };
  assert({ actual, expect });
}

{
  const pattern = "file:///**/a/**/";
  const url = "file:///b/a/c.js";
  const actual = URL_META.applyPatternMatching({ pattern, url });
  const expect = {
    matched: true,
    patternIndex: pattern.length,
    urlIndex: url.length,
    matchGroups: [],
  };
  assert({ actual, expect });
}
