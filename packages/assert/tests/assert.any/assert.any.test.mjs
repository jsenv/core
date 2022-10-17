import { assert } from "@jsenv/assert"
import { ensureAssertionErrorWithMessage } from "@jsenv/assert/tests/ensureAssertionErrorWithMessage.js"
import { executeInNewContext } from "@jsenv/assert/tests/executeInNewContext.js"

{
  const actual = await executeInNewContext("[]")
  const expected = assert.any(Array)
  assert({ actual, expected })
}

{
  class User {}
  const user = new User()
  const actual = user
  const expected = assert.any(User)
  assert({ actual, expected })
}

{
  class User {}
  const actual = {}
  const expected = assert.any(User)
  try {
    assert({ actual, expected })
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `unexpected value
--- found ---
{}
--- expected ---
any(${User.name})
--- path ---
actual`,
    )
  }
}

{
  const actual = "foo"
  const expected = assert.any(String)
  assert({ actual, expected })
}

{
  // eslint-disable-next-line no-new-wrappers
  const actual = new String("foo")
  const expected = assert.any(String)
  assert({ actual, expected })
}

{
  const actual = /yo/
  const expected = assert.any(RegExp)
  assert({ actual, expected })
}

{
  const actual = new Date()
  const expected = assert.any(Date)
  assert({ actual, expected })
}

{
  const actual = new Error()
  const expected = assert.any(Error)
  assert({ actual, expected })
}

{
  const actual = new TypeError()
  const expected = assert.any(Error)
  assert({ actual, expected })
}

{
  const actual = new TypeError()
  const expected = assert.any(TypeError)
  assert({ actual, expected })
}

try {
  const actual = new Error()
  const expected = assert.any(TypeError)
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `unexpected value
--- found ---
Error("")
--- expected ---
any(TypeError)
--- path ---
actual`,
  )
}

try {
  const actual = 10
  const expected = assert.any(String)
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `unexpected value
--- found ---
10
--- expected ---
any(String)
--- path ---
actual`,
  )
}

try {
  const actual = {
    token: true,
  }
  const expected = {
    token: assert.any(String),
  }
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `unexpected value
--- found ---
true
--- expected ---
any(String)
--- path ---
actual.token`,
  )
}
