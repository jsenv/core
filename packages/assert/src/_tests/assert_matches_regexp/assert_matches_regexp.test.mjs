import { assert } from "@jsenv/assert"
import { ensureAssertionErrorWithMessage } from "../ensureAssertionErrorWithMessage.js"

{
  const actual = "expired 3 seconds ago"
  const expected = assert.matchesRegExp(/expired \d seconds ago/)
  assert({ actual, expected })
}

{
  const actual = "expired n seconds ago"
  const expected = assert.matchesRegExp(/expired \d seconds ago/)
  try {
    assert({ actual, expected })
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `unexpected value
--- found ---
"expired n seconds ago"
--- expected ---
matchesRegExp(/expired \\\d seconds ago/)
--- path ---
actual`,
    )
  }
}
