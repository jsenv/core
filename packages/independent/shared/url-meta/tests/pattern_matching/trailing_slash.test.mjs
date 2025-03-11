import { assert } from "@jsenv/assert";

import { URL_META } from "@jsenv/url-meta";

{
  const pattern = "file:///a/";
  const url = "file:///a/";
  const actual = URL_META.applyPatternMatching({ pattern, url });
  const expect = {
    matched: true,
    patternIndex: pattern.length,
    urlIndex: url.length,
    matchGroups: ["/"],
  };
  assert({ actual, expect });
}

{
  const pattern = "file:///a/";
  const url = "file:///a/b";
  const actual = URL_META.applyPatternMatching({ pattern, url });
  const expect = {
    matched: true,
    patternIndex: pattern.length,
    urlIndex: url.length,
    matchGroups: ["/b"],
  };
  assert({ actual, expect });
}

{
  const pattern = "file:///a/";
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
  const pattern = "file:///a";
  const url = "file:///a/b.js";
  const actual = URL_META.applyPatternMatching({ pattern, url });
  const expect = {
    matched: false,
    patternIndex: pattern.length,
    urlIndex: url.indexOf("/b.js"),
    matchGroups: [],
  };
  assert({ actual, expect });
}
