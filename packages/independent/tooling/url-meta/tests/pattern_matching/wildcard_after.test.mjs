import { assert } from "@jsenv/assert";

import { URL_META } from "@jsenv/url-meta";

{
  const pattern = "file:///a*";
  const url = "file:///a";
  const actual = URL_META.applyPatternMatching({ pattern, url });
  const expect = {
    matched: false,
    patternIndex: pattern.indexOf("*"),
    urlIndex: url.length,
    matchGroups: [""],
  };
  assert({ actual, expect });
}

{
  const pattern = "file:///a*";
  const url = "file:///aZ";
  const actual = URL_META.applyPatternMatching({ pattern, url });
  const expect = {
    matched: true,
    patternIndex: pattern.length,
    urlIndex: url.length,
    matchGroups: ["Z"],
  };
  assert({ actual, expect });
}

{
  const pattern = "file:///a*";
  const url = "file:///aZZZ";
  const actual = URL_META.applyPatternMatching({ pattern, url });
  const expect = {
    matched: true,
    patternIndex: pattern.length,
    urlIndex: url.length,
    matchGroups: ["ZZZ"],
  };
  assert({ actual, expect });
}

{
  const pattern = "file:///a*";
  const url = "file:///Za";
  const actual = URL_META.applyPatternMatching({ pattern, url });
  const expect = {
    matched: false,
    patternIndex: pattern.indexOf("a*"),
    urlIndex: url.indexOf("Za"),
    matchGroups: [],
  };
  assert({ actual, expect });
}

{
  const pattern = "file:///a*";
  const url = "file:///a/";
  const actual = URL_META.applyPatternMatching({ pattern, url });
  const expect = {
    matched: false,
    patternIndex: pattern.indexOf("*"),
    urlIndex: url.lastIndexOf("/"),
    matchGroups: [""],
  };
  assert({ actual, expect });
}
