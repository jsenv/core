import { assert } from "@jsenv/assert"

import { Abort } from "@jsenv/abort"
import { startServer } from "./test_helpers.mjs"

const abortController = new AbortController()

try {
  abortController.abort()
  await startServer({ signal: abortController.signal })
  throw new Error("should abort")
} catch (error) {
  const actual = Abort.isAbortError(error)
  const expected = true
  assert({ actual, expected })
}
