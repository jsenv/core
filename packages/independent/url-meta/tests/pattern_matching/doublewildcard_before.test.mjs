import { assert } from "@jsenv/assert";

import { URL_META } from "@jsenv/url-meta";

{
  const pattern = "file:///**/a";
  const url = "file:///a";
  const actual = URL_META.applyPatternMatching({ pattern, url });
  const expect = {
    matched: true,
    patternIndex: actual.patternIndex,
    urlIndex: actual.urlIndex,
    matchGroups: [],
  };
  assert({ actual, expect });
}

{
  const pattern = "file:///**/a/";
  const url = "file:///a";
  const actual = URL_META.applyPatternMatching({ pattern, url });
  const expect = {
    matched: false,
    patternIndex: pattern.lastIndexOf("/"),
    urlIndex: url.length,
    matchGroups: [],
  };
  assert({ actual, expect });
}

{
  const pattern = "file:///**/a";
  const url = "file:///b/a";
  const { matched } = URL_META.applyPatternMatching({ pattern, url });
  const actual = matched;
  const expect = true;
  assert({ actual, expect });
}

{
  const pattern = "file:///**/a";
  const url = "file:///c/b/a";
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
  const pattern = "file:///**/a";
  const url = "file:///a.js";
  const actual = URL_META.applyPatternMatching({ pattern, url });
  const expect = {
    matched: false,
    patternIndex: pattern.length,
    urlIndex: 9,
    matchGroups: [],
  };
  assert({ actual, expect });
}
