import { assert } from "@jsenv/assert";

import { URL_META } from "@jsenv/url-meta";

{
  const pattern = "file:///*a";
  const url = "file:///a";
  const actual = URL_META.applyPatternMatching({ pattern, url });
  const expect = {
    matched: false,
    patternIndex: pattern.indexOf("*"),
    urlIndex: url.indexOf("a"),
    matchGroups: [""],
  };
  assert({ actual, expect });
}

{
  const pattern = "file:///*a";
  const url = "file:///Za";
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
  const pattern = "file:///*a";
  const url = "file:///ZZZa";
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
  const pattern = "file:///*a";
  const url = "file:///aZ";
  const actual = URL_META.applyPatternMatching({ pattern, url });
  const expect = {
    matched: false,
    patternIndex: pattern.indexOf("*"),
    urlIndex: url.indexOf("a"),
    matchGroups: [""],
  };
  assert({ actual, expect });
}
