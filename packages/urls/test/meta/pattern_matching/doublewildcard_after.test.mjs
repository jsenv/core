import { assert } from "@jsenv/assert"

import { URL_META } from "@jsenv/urls"

{
  const pattern = "file:///a/**"
  const url = "file:///a"
  const actual = URL_META.applyPatternMatching({ pattern, url })
  const expected = {
    matched: false,
    patternIndex: pattern.indexOf("/**"),
    urlIndex: url.length,
    matchGroups: [],
  }
  assert({ actual, expected })
}

{
  const pattern = "file:///a/**"
  const url = "file:///a/b"
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
  const pattern = "file:///a/**"
  const url = "file:///a/b/c"
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
  const pattern = "file:///a/**"
  const url = "file:///a/a.js"
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
  const pattern = "file:///a/**"
  const url = "file:///a.js"
  const actual = URL_META.applyPatternMatching({ pattern, url })
  const expected = {
    matched: false,
    patternIndex: pattern.indexOf("/**"),
    urlIndex: url.indexOf(".js"),
    matchGroups: [],
  }
  assert({ actual, expected })
}

{
  const pattern = "file:///**"
  const url = "file:///"
  const actual = URL_META.applyPatternMatching({ pattern, url })
  const expected = {
    matched: true,
    patternIndex: pattern.length,
    urlIndex: url.length,
    matchGroups: [],
  }
  assert({ actual, expected })
}
