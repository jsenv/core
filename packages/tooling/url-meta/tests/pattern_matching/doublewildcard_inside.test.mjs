import { assert } from "@jsenv/assert";

import { URL_META } from "@jsenv/url-meta";

{
  const pattern = "file:///a/**/b/c";
  const url = "file:///a/b/c";
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
  const pattern = "file:///**.js";
  const url = "file:///a.js";
  const actual = URL_META.applyPatternMatching({ pattern, url });
  const expect = {
    matched: true,
    patternIndex: 13,
    urlIndex: 12,
    matchGroups: [],
  };
  assert({ actual, expect });
}

{
  const pattern = "file:///**.js";
  const url = "file:///.js";
  const actual = URL_META.applyPatternMatching({ pattern, url });
  const expect = {
    matched: true,
    patternIndex: pattern.length,
    urlIndex: url.length,
    matchGroups: [],
  };
  assert({ actual, expect });
}
