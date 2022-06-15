import { assert } from "@jsenv/assert"

import { fileSystemPathToUrl } from "@jsenv/filesystem"

const isWindows = process.platform === "win32"

if (isWindows) {
  const actual = fileSystemPathToUrl("C:/Users/file.js")
  const expected = "file:///C:/Users/file.js"
  assert({ actual, expected })
} else {
  const actual = fileSystemPathToUrl("/Users/file.js")
  const expected = "file:///Users/file.js"
  assert({ actual, expected })
}

try {
  fileSystemPathToUrl("file:///Users/file.js")
  throw new Error("should throw")
} catch (actual) {
  const expected = new Error(
    `received an invalid value for fileSystemPath: file:///Users/file.js`,
  )
  assert({ actual, expected })
}
