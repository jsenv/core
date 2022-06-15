import { assert } from "@jsenv/assert"

import { assertAndNormalizeFileUrl } from "@jsenv/filesystem"

const isWindows = process.platform === "win32"

try {
  assertAndNormalizeFileUrl()
  throw new Error("should throw")
} catch (actual) {
  const expected = new TypeError(
    "fileUrl must be a string or an url, received undefined",
  )
  assert({ actual, expected })
}

try {
  assertAndNormalizeFileUrl("http://example.com")
  throw new Error("should throw")
} catch (actual) {
  const expected = new Error(
    `fileUrl must starts with file://, received http://example.com`,
  )
  assert({ actual, expected })
}

{
  const actual = assertAndNormalizeFileUrl("file:///directory/file.js")
  const expected = "file:///directory/file.js"
  assert({ actual, expected })
}

if (isWindows) {
  const actual = assertAndNormalizeFileUrl("C:/directory/file.js")
  const expected = "file:///C:/directory/file.js"
  assert({ actual, expected })
} else {
  const actual = assertAndNormalizeFileUrl("/directory/file.js")
  const expected = "file:///directory/file.js"
  assert({ actual, expected })
}

{
  const actual = assertAndNormalizeFileUrl(new URL("file:///directory/file.js"))
  const expected = "file:///directory/file.js"
  assert({ actual, expected })
}
