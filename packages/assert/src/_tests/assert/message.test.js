import { assert } from "@jsenv/assert"
import { ensureAssertionErrorWithMessage } from "../ensureAssertionErrorWithMessage.js"

try {
  const actual = true
  const expected = false
  assert({ actual, expected, message: "should be true" })
} catch (e) {
  ensureAssertionErrorWithMessage(e, `should be true`)
}
