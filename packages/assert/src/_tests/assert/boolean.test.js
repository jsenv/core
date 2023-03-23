import { assert } from "@jsenv/assert"
import { ensureAssertionErrorWithMessage } from "../ensureAssertionErrorWithMessage.js"

{
  const actual = true
  const expected = true
  assert({ actual, expected })
}

try {
  // eslint-disable-next-line no-new-wrappers
  const actual = new Boolean(true)
  // eslint-disable-next-line no-new-wrappers
  const expected = new Boolean(true)
  assert({ actual, expected })
} catch (e) {
  throw new Error(`should not throw`)
}

try {
  const actual = true
  const expected = false
  assert({ actual, expected })
  throw new Error("should throw")
} catch (error) {
  ensureAssertionErrorWithMessage(
    error,
    `unequal values
--- found ---
true
--- expected ---
false
--- path ---
actual`,
  )
}

try {
  // eslint-disable-next-line no-new-wrappers
  const actual = new Boolean(true)
  // eslint-disable-next-line no-new-wrappers
  const expected = new Boolean(false)
  assert({ actual, expected })
  throw new Error("should throw")
} catch (error) {
  ensureAssertionErrorWithMessage(
    error,
    `unequal values
--- found ---
true
--- expected ---
false
--- path ---
actual.valueOf()`,
  )
}

try {
  const actual = 0
  const expected = false
  assert({ actual, expected })
  throw new Error("should throw")
} catch (error) {
  ensureAssertionErrorWithMessage(
    error,
    `unequal values
--- found ---
0
--- expected ---
false
--- path ---
actual`,
  )
}
