import { assert } from "@jsenv/assert"
import { ensureAssertionErrorWithMessage } from "../ensureAssertionErrorWithMessage.js"

try {
  const actual = Object.seal({ foo: true })
  const expected = Object.seal({ foo: true })
  assert({ actual, expected })
} catch (e) {
  throw new Error(`should not throw`)
}

try {
  const actual = Object.freeze({})
  const expected = Object.freeze({})
  assert({ actual, expected })
} catch (e) {
  throw new Error(`should not throw`)
}

try {
  const actual = {}
  const expected = Object.seal({ foo: true })
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `unequal values
--- found ---
"none"
--- expected ---
"sealed"
--- path ---
actual[[Integrity]]`,
  )
}

try {
  const actual = Object.seal({ foo: true })
  const expected = {}
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `unequal values
--- found ---
"sealed"
--- expected ---
"none"
--- path ---
actual[[Integrity]]`,
  )
}

try {
  const actual = {}
  const expected = Object.freeze({})
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `unequal values
--- found ---
"none"
--- expected ---
"frozen"
--- path ---
actual[[Integrity]]`,
  )
}

try {
  const actual = Object.freeze({})
  const expected = {}
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `unequal values
--- found ---
"frozen"
--- expected ---
"none"
--- path ---
actual[[Integrity]]`,
  )
}

try {
  const actual = Object.freeze({})
  const expected = Object.seal({ foo: true })
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `unequal values
--- found ---
"frozen"
--- expected ---
"sealed"
--- path ---
actual[[Integrity]]`,
  )
}

try {
  const actual = Object.seal({ foo: true })
  const expected = Object.freeze({})
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `unequal values
--- found ---
"sealed"
--- expected ---
"frozen"
--- path ---
actual[[Integrity]]`,
  )
}
