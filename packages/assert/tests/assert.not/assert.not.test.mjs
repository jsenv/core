import { assert } from "@jsenv/assert"
import { ensureAssertionErrorWithMessage } from "@jsenv/assert/tests/ensureAssertionErrorWithMessage.js"

{
  const actual = 41
  const expected = assert.not(42)
  assert({ actual, expected })
}

{
  const actual = -0
  const expected = assert.not(0)
  assert({ actual, expected })
}

{
  const actual = 0
  const expected = assert.not(-0)
  assert({ actual, expected })
}

{
  const actual = -0
  const expected = assert.not(-0)
  try {
    assert({ actual, expected })
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `unexpected value
--- found ---
-0
--- expected ---
an other value
--- path ---
actual`,
    )
  }
}

{
  const actual = 42
  const expected = assert.not(42)
  try {
    assert({ actual, expected })
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `unexpected value
--- found ---
42
--- expected ---
an other value
--- path ---
actual`,
    )
  }
}
