import { assert } from "@jsenv/assert"
import { ensureAssertionErrorWithMessage } from "../ensureAssertionErrorWithMessage.js"

try {
  const actual = { foo: true }
  const expected = { foo: true }
  assert({ actual, expected })
} catch (e) {
  throw new Error(`should not throw`)
}

try {
  const actual = { foo: true }
  const expected = { foo: false }
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
actual.foo`,
  )
}

try {
  const actual = { ["with space"]: true }
  const expected = { ["with space"]: false }
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
actual["with space"]`,
  )
}

try {
  const symbol = Symbol()
  const actual = { [symbol]: true }
  const expected = { [symbol]: true }
  assert({ actual, expected })
} catch (e) {
  throw new Error(`should not throw`)
}

try {
  const symbol = Symbol()
  const actual = { [symbol]: true }
  const expected = { [symbol]: false }
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
actual[Symbol()]`,
  )
}

try {
  const symbol = Symbol.iterator
  const actual = { [symbol]: true }
  const expected = { [symbol]: false }
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
actual[Symbol.iterator]`,
  )
}

try {
  const symbol = Symbol("foo")
  const actual = { [symbol]: true }
  const expected = { [symbol]: false }
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
actual[Symbol("foo")]`,
  )
}

try {
  const symbol = Symbol.for("foo")
  const actual = { [symbol]: true }
  const expected = { [symbol]: false }
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
actual[Symbol.for("foo")]`,
  )
}
