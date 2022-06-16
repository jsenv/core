import { assert } from "@jsenv/assert"

import { URL_META } from "@jsenv/url-meta"

{
  const pattern = "file:///**/a"
  const url = "file:///a"
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
  const pattern = "file:///**/a/"
  const url = "file:///a"
  const actual = URL_META.applyPatternMatching({ pattern, url })
  const expected = {
    matched: false,
    patternIndex: pattern.lastIndexOf("/"),
    urlIndex: url.length,
    matchGroups: [],
  }
  assert({ actual, expected })
}

{
  const pattern = "file:///**/a"
  const url = "file:///b/a"
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
  const pattern = "file:///**/a"
  const url = "file:///c/b/a"
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
  const pattern = "file:///**/a"
  const url = "file:///a.js"
  const actual = URL_META.applyPatternMatching({ pattern, url })
  const expected = {
    matched: false,
    patternIndex: pattern.length,
    urlIndex: url.length,
    matchGroups: [],
  }
  assert({ actual, expected })
}
