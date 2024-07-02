import { assert } from "@jsenv/assert";

import { URL_META } from "@jsenv/url-meta";

{
  const pattern = "file:///*a*";
  const url = "file:///abc";
  const actual = URL_META.applyPatternMatching({ pattern, url });
  const expect = {
    matched: false,
    patternIndex: pattern.indexOf("*a*"),
    urlIndex: url.indexOf("abc"),
    matchGroups: [""],
  };
  assert({ actual, expect });
}

{
  const pattern = "file:///*a*";
  const url = "file:///Za";
  const actual = URL_META.applyPatternMatching({ pattern, url });
  const expect = {
    matched: false,
    patternIndex: pattern.lastIndexOf("*"),
    urlIndex: url.length,
    matchGroups: ["Z", ""],
  };
  assert({ actual, expect });
}

{
  const pattern = "file:///*a*";
  const url = "file:///aZ";
  const actual = URL_META.applyPatternMatching({ pattern, url });
  const expect = {
    matched: false,
    patternIndex: pattern.indexOf("*a*"),
    urlIndex: url.indexOf("aZ"),
    matchGroups: [""],
  };
  assert({ actual, expect });
}

{
  const pattern = "file:///*a*";
  const url = "file:///ZZa";
  const actual = URL_META.applyPatternMatching({ pattern, url });
  const expect = {
    matched: false,
    patternIndex: pattern.lastIndexOf("*"),
    urlIndex: url.length,
    matchGroups: ["ZZ", ""],
  };
  assert({ actual, expect });
}

{
  const pattern = "file:///*a*";
  const url = "file:///aZZ";
  const actual = URL_META.applyPatternMatching({ pattern, url });
  const expect = {
    matched: false,
    patternIndex: pattern.indexOf("*a*"),
    urlIndex: url.indexOf("aZZ"),
    matchGroups: [""],
  };
  assert({ actual, expect });
}

{
  const pattern = "file:///*a*";
  const url = "file:///ZaY";
  const actual = URL_META.applyPatternMatching({ pattern, url });
  const expect = {
    matched: true,
    patternIndex: pattern.length,
    urlIndex: url.length,
    matchGroups: ["Z", "Y"],
  };
  assert({ actual, expect });
}

{
  const pattern = "file:///*a*";
  const url = "file:///ZZaYY";
  const actual = URL_META.applyPatternMatching({ pattern, url });
  const expect = {
    matched: true,
    patternIndex: pattern.length,
    urlIndex: url.length,
    matchGroups: ["ZZ", "YY"],
  };
  assert({ actual, expect });
}
