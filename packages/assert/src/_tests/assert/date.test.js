import { assert } from "@jsenv/assert"
import { ensureAssertionErrorWithMessage } from "../ensureAssertionErrorWithMessage.js"

{
  const actual = new Date(10)
  const expected = new Date(10)
  assert({ actual, expected })
}

{
  const actual = new Date(10)
  const expected = new Date(11)
  try {
    assert({ actual, expected })
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `unequal values
--- found ---
10
--- expected ---
11
--- path ---
actual.valueOf()`,
    )
  }
}
