import { assert } from "@jsenv/assert";

import { URL_META } from "@jsenv/url-meta";

{
  const pattern = "file:///a*bc";
  const url = "file:///abc";
  const actual = URL_META.applyPatternMatching({ pattern, url });
  const expect = {
    matched: false,
    patternIndex: pattern.indexOf("*"),
    urlIndex: url.indexOf("b"),
    matchGroups: [""],
  };
  assert({ actual, expect });
}

{
  const pattern = "file:///a*bc";
  const url = "file:///aZZbc";
  const actual = URL_META.applyPatternMatching({ pattern, url });
  const expect = {
    matched: true,
    patternIndex: pattern.length,
    urlIndex: url.length,
    matchGroups: ["ZZ"],
  };
  assert({ actual, expect });
}

{
  const pattern = "file:///a*bc";
  const url = "file:///aZZbd";
  const actual = URL_META.applyPatternMatching({ pattern, url });
  const expect = {
    matched: false,
    patternIndex: pattern.lastIndexOf("c"),
    urlIndex: url.lastIndexOf("d"),
    matchGroups: ["ZZ"],
  };
  assert({ actual, expect });
}

{
  const pattern = "file:///a/b*/c";
  const url = "file:///a/bZ/c";
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
  const pattern = "file:///a/b*/c";
  const url = "file:///a/b/c";
  const actual = URL_META.applyPatternMatching({ pattern, url });
  const expect = {
    matched: false,
    patternIndex: pattern.indexOf("*"),
    urlIndex: url.indexOf("/c"),
    matchGroups: [""],
  };
  assert({ actual, expect });
}
