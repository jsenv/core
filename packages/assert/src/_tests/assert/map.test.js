import { assert } from "@jsenv/assert"
import { ensureAssertionErrorWithMessage } from "../ensureAssertionErrorWithMessage.js"

try {
  const actual = new Map()
  const expected = new Map()
  assert({ actual, expected })
} catch (e) {
  throw new Error(`should not throw`)
}

try {
  const actual = new Map()
  actual.set("answer", 42)
  const expected = new Map()
  expected.set("answer", 42)
  assert({ actual, expected })
} catch (e) {
  throw new Error(`should not throw`)
}

try {
  const actual = new Map()
  actual.set({}, 42)
  actual.set({}, 43)
  const expected = new Map()
  expected.set({}, 42)
  expected.set({}, 43)
  assert({ actual, expected })
} catch (e) {
  throw new Error(`should not throw`)
}

try {
  const actual = new Map()
  actual.set({}, 42)
  actual.set({ foo: true }, 43)
  const expected = new Map()
  expected.set({}, 42)
  expected.set({}, 43)
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `an entry is unexpected
--- unexpected entry key ---
{
  "foo": true
}
--- unexpected entry value ---
43
--- path ---
actual`,
  )
}

try {
  const actual = new Map()
  actual.set("foo", { foo: true })
  const expected = new Map()
  expected.set("foo", { foo: false })
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
actual[[mapEntry:0]].value.foo`,
  )
}

try {
  const actual = new Map()
  actual.set("foo", true)
  actual.set("bar", true)
  const expected = new Map()
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `an entry is unexpected
--- unexpected entry key ---
"foo"
--- unexpected entry value ---
true
--- path ---
actual`,
  )
}

try {
  const actual = new Map()
  const expected = new Map()
  expected.set("foo", true)
  expected.set("bar", true)
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `an entry is missing
--- missing entry key ---
"foo"
--- missing entry value ---
true
--- path ---
actual`,
  )
}
