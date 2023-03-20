import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"

try {
  await startDevServer({ rootDirectoryUl: new URL("./", import.meta.url) })
  throw new Error("should throw")
} catch (e) {
  const actual = e
  const expected = new TypeError(
    `rootDirectoryUl: there is no such params to this function`,
  )
  assert({ actual, expected })
}

try {
  await startDevServer({ rootDirectoryUrl: undefined })
  throw new Error("should throw")
} catch (e) {
  const actual = e
  const expected = new TypeError(
    `rootDirectoryUrl is invalid, it must be a string or an url (got undefined)`,
  )
  assert({ actual, expected })
}
