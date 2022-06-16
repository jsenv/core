import { assert } from "@jsenv/assert"

import { URL_META } from "@jsenv/url-meta"

{
  const pattern = "file:///.git/"
  const url = "file:///.github/"
  const actual = URL_META.applyPatternMatching({ pattern, url })
  const expected = {
    matched: false,
    patternIndex: pattern.lastIndexOf("/"),
    urlIndex: url.indexOf("hub"),
    matchGroups: [],
  }
  assert({ actual, expected })
}

try {
  URL_META.applyPatternMatching({
    pattern: 10,
  })
  throw new Error("should throw")
} catch (actual) {
  const expected = new TypeError("pattern must be a url string, got 10")
  assert({ actual, expected })
}

try {
  URL_META.applyPatternMatching({
    pattern: "C://Users/folder/file.js",
  })
  throw new Error("should throw")
} catch (actual) {
  const expected = new TypeError(
    "pattern must be a url but looks like a windows pathname, got C://Users/folder/file.js",
  )
  assert({ actual, expected })
}

try {
  URL_META.applyPatternMatching({
    pattern: "hello",
  })
  throw new Error("should throw")
} catch (actual) {
  const expected = new TypeError(
    "pattern must be a url and no scheme found, got hello",
  )
  assert({ actual, expected })
}

try {
  URL_META.applyPatternMatching({
    pattern: "http://",
    url: 10,
  })
  throw new Error("should throw")
} catch (actual) {
  const expected = new TypeError("url must be a url string, got 10")
  assert({ actual, expected })
}

{
  const pattern = "file:///foo.js"
  const url = "file:///foo.js"
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
  const pattern = "http:///foo.js"
  const url = "file:///foo.js"
  const actual = URL_META.applyPatternMatching({ pattern, url })
  const expected = {
    matched: false,
    patternIndex: 0,
    urlIndex: 0,
    matchGroups: [],
  }
  assert({ actual, expected })
}

{
  const pattern = "file:///bar.js"
  const url = "file:///foo.js"
  const actual = URL_META.applyPatternMatching({ pattern, url })
  const expected = {
    matched: false,
    patternIndex: pattern.indexOf("bar.js"),
    urlIndex: url.indexOf("foo.js"),
    matchGroups: [],
  }
  assert({ actual, expected })
}
