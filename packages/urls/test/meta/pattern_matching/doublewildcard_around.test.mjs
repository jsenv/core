import { assert } from "@jsenv/assert"

import { URL_META } from "@jsenv/urls"

{
  const pattern = "file:///**/a/**/"
  const url = "file:///a"
  const actual = URL_META.applyPatternMatching({ pattern, url })
  const expected = {
    matched: false,
    patternIndex: pattern.lastIndexOf("/**/"),
    urlIndex: url.length,
    matchGroups: [],
  }
  assert({ actual, expected })
}

{
  const pattern = "file:///**/a/**/"
  const url = "file:///a/b/c.js"
  const actual = URL_META.applyPatternMatching({ pattern, url })
  const expected = {
    matched: true,
    patternIndex: pattern.length,
    urlIndex: url.length,
    matchGroups: [],
  }
  assert({ actual, expected })
}

{
  const pattern = "file:///**/a/**/"
  const url = "file:///b/a/c.js"
  const actual = URL_META.applyPatternMatching({ pattern, url })
  const expected = {
    matched: true,
    patternIndex: pattern.length,
    urlIndex: url.length,
    matchGroups: [],
  }
  assert({ actual, expected })
}
