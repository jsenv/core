import { assert } from "@jsenv/assert"

import { resolveUrl } from "@jsenv/filesystem"

{
  const actual = resolveUrl("./file.js", "file:///directory/")
  const expected = "file:///directory/file.js"
  assert({ actual, expected })
}

{
  const specifier = "./foo.js"

  try {
    resolveUrl(specifier)
    throw new Error("should throw")
  } catch (actual) {
    const expected = new TypeError(`baseUrl missing to resolve ${specifier}`)
    assert({ actual, expected })
  }
}
