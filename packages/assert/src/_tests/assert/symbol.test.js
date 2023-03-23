import { assert } from "@jsenv/assert"
import { ensureAssertionErrorWithMessage } from "../ensureAssertionErrorWithMessage.js"

try {
  const actual = Symbol()
  const expected = actual
  assert({ actual, expected })
} catch (e) {
  throw new Error(`should not throw`)
}

try {
  const actual = Symbol.for("foo")
  const expected = Symbol.for("foo")
  assert({ actual, expected })
} catch (e) {
  throw new Error(`should not throw`)
}

try {
  const actual = Symbol()
  const expected = Symbol()
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `unequal values
--- found ---
Symbol()
--- expected ---
Symbol()
--- path ---
actual`,
  )
}

try {
  const actual = Symbol("foo")
  const expected = Symbol("bar")
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `unequal values
--- found ---
Symbol("foo")
--- expected ---
Symbol("bar")
--- path ---
actual`,
  )
}

// ensure unequal symbols is checked before unexpected symbol
// (because it gives more helpful error message)
try {
  const symbola = Symbol("a")
  const symbolb = Symbol("b")
  const actual = {
    [symbola]: true,
  }
  const expected = {
    [symbola]: false,
    [symbolb]: true,
  }
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `unequal values
--- found ---
true
--- expected ---
false
--- path ---
actual[Symbol("a")]`,
  )
}
