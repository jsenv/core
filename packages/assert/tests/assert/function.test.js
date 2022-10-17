import { assert } from "@jsenv/assert"
import { ensureAssertionErrorWithMessage } from "@jsenv/assert/tests/ensureAssertionErrorWithMessage.js"

// anonymous funciton
{
  const actual = (function () {
    return function () {}
  })()
  const expected = (function () {
    return function () {}
  })()
  assert({ actual, expected })
}

// anonymous arrow function
{
  const actual = (function () {
    return () => {}
  })()
  const expected = (function () {
    return () => {}
  })()
  assert({ actual, expected })
}

// named arrow function
{
  const actual = () => {}
  const expected = () => {}
  try {
    assert({ actual, expected })
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `unequal function names
--- found ---
"${actual.name}"
--- expected ---
"${expected.name}"
--- path ---
actual.name
--- details ---
unexpected character at index 0, "a" was found instead of "e"`,
    )
  }
}
