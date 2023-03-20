import { assert } from "@jsenv/assert"

import { assertAndNormalizeDirectoryUrl } from "@jsenv/filesystem"

const isWindows = process.platform === "win32"

try {
  assertAndNormalizeDirectoryUrl()
  throw new Error("should throw")
} catch (actual) {
  const expected = new TypeError(
    "directoryUrl must be a string or an url, got undefined",
  )
  assert({ actual, expected })
}

try {
  assertAndNormalizeDirectoryUrl("http://example.com")
  throw new Error("should throw")
} catch (actual) {
  const expected = new TypeError(
    `directoryUrl must start with "file://", got http://example.com`,
  )
  assert({ actual, expected })
}

{
  const actual = assertAndNormalizeDirectoryUrl("file:///directory")
  const expected = "file:///directory/"
  assert({ actual, expected })
}

if (isWindows) {
  const actual = assertAndNormalizeDirectoryUrl("C:/directory")
  const expected = "file:///C:/directory/"
  assert({ actual, expected })
} else {
  const actual = assertAndNormalizeDirectoryUrl("/directory")
  const expected = "file:///directory/"
  assert({ actual, expected })
}

{
  const actual = assertAndNormalizeDirectoryUrl(new URL("file:///directory"))
  const expected = "file:///directory/"
  assert({ actual, expected })
}
