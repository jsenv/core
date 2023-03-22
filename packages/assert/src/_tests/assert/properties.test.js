import { assert } from "@jsenv/assert"
import { ensureAssertionErrorWithMessage } from "../ensureAssertionErrorWithMessage.js"

try {
  const actual = {
    foo: true,
    bar: true,
  }
  const expected = {
    foo: true,
    bar: true,
  }
  assert({ actual, expected })
} catch (e) {
  throw new Error(`should not throw`)
}

try {
  const actual = {
    a: true,
  }
  const expected = {}
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `1 unexpected property
--- unexpected property ---
{
  "a": true
}
--- path ---
actual`,
  )
}

try {
  const actual = {
    a: true,
    b: true,
  }
  const expected = {}
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `2 unexpected properties
--- unexpected properties ---
{
  "a": true,
  "b": true
}
--- path ---
actual`,
  )
}

try {
  const actual = {}
  const expected = {
    a: true,
  }
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `1 missing property
--- missing property ---
{
  "a": true
}
--- path ---
actual`,
  )
}

try {
  const actual = {}
  const expected = {
    a: true,
    b: true,
  }
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `2 missing properties
--- missing properties ---
{
  "a": true,
  "b": true
}
--- path ---
actual`,
  )
}

try {
  const actual = {
    a: true,
    d: true,
    e: true,
  }
  const expected = {
    a: true,
    b: true,
    c: true,
  }
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `2 unexpected properties and 2 missing properties
--- unexpected properties ---
{
  "d": true,
  "e": true
}
--- missing properties ---
{
  "b": true,
  "c": true
}
--- path ---
actual`,
  )
}

try {
  const actual = {
    a: true,
    d: true,
    e: true,
  }
  const expected = {
    a: true,
    b: true,
  }
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `2 unexpected properties and 1 missing property
--- unexpected properties ---
{
  "d": true,
  "e": true
}
--- missing property ---
{
  "b": true
}
--- path ---
actual`,
  )
}

try {
  const actual = {
    a: true,
    d: true,
  }
  const expected = {
    a: true,
    b: true,
    c: true,
  }
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `1 unexpected property and 2 missing properties
--- unexpected property ---
{
  "d": true
}
--- missing properties ---
{
  "b": true,
  "c": true
}
--- path ---
actual`,
  )
}

try {
  const actual = {
    a: true,
    d: true,
  }
  const expected = {
    a: true,
    b: true,
  }
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `1 unexpected property and 1 missing property
--- unexpected property ---
{
  "d": true
}
--- missing property ---
{
  "b": true
}
--- path ---
actual`,
  )
}

// ensure unequal properties is checked before unexpected property
// (because it gives more helpful error message)
try {
  const actual = {
    a: true,
    c: false,
  }
  const expected = {
    a: false,
    b: true,
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
actual.a`,
  )
}
