import { assert } from "@jsenv/assert"

import { URL_META } from "@jsenv/urls"

{
  const pattern = "file:///a*bc"
  const url = "file:///abc"
  const actual = URL_META.applyPatternMatching({ pattern, url })
  const expected = {
    matched: false,
    patternIndex: pattern.indexOf("*"),
    urlIndex: url.indexOf("b"),
    matchGroups: [""],
  }
  assert({ actual, expected })
}

{
  const pattern = "file:///a*bc"
  const url = "file:///aZZbc"
  const actual = URL_META.applyPatternMatching({ pattern, url })
  const expected = {
    matched: true,
    patternIndex: pattern.length,
    urlIndex: url.length,
    matchGroups: ["ZZ"],
  }
  assert({ actual, expected })
}

{
  const pattern = "file:///a*bc"
  const url = "file:///aZZbd"
  const actual = URL_META.applyPatternMatching({ pattern, url })
  const expected = {
    matched: false,
    patternIndex: pattern.lastIndexOf("c"),
    urlIndex: url.lastIndexOf("d"),
    matchGroups: ["ZZ"],
  }
  assert({ actual, expected })
}

{
  const pattern = "file:///a/b*/c"
  const url = "file:///a/bZ/c"
  const actual = URL_META.applyPatternMatching({ pattern, url })
  const expected = {
    matched: true,
    patternIndex: pattern.length,
    urlIndex: url.length,
    matchGroups: ["Z"],
  }
  assert({ actual, expected })
}

{
  const pattern = "file:///a/b*/c"
  const url = "file:///a/b/c"
  const actual = URL_META.applyPatternMatching({ pattern, url })
  const expected = {
    matched: false,
    patternIndex: pattern.indexOf("*"),
    urlIndex: url.indexOf("/c"),
    matchGroups: [""],
  }
  assert({ actual, expected })
}
