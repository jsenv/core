import { assert } from "@jsenv/assert"
import { ensureAssertionErrorWithMessage } from "@jsenv/assert/tests/ensureAssertionErrorWithMessage.js"

try {
  const symbola = Symbol("a")
  const symbolb = Symbol("b")
  const actual = {
    [symbola]: true,
    [symbolb]: true,
  }
  const expected = {
    [symbola]: true,
    [symbolb]: true,
  }
  assert({ actual, expected })
} catch (e) {
  throw new Error(`should not throw`)
}

try {
  const symbola = Symbol("a")
  const actual = {
    [symbola]: true,
  }
  const expected = {}
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `unexpected symbols
--- unexpected symbol list ---
Symbol("a")
--- path ---
actual`,
  )
}

try {
  const symbola = Symbol("a")
  const actual = {}
  const expected = {
    [symbola]: true,
  }
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `missing symbols
--- missing symbol list ---
Symbol("a")
--- path ---
actual`,
  )
}

try {
  const symbola = Symbol("a")
  const symbolb = Symbol("b")
  const symbolc = Symbol("c")
  const symbold = Symbol("d")
  const symbole = Symbol("e")
  const actual = {
    [symbola]: true,
    [symbold]: true,
    [symbole]: true,
  }
  const expected = {
    [symbola]: true,
    [symbolb]: true,
    [symbolc]: true,
  }
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `unexpected and missing symbols
--- unexpected symbol list ---
Symbol("d")
Symbol("e")
--- missing symbol list ---
Symbol("b")
Symbol("c")
--- path ---
actual`,
  )
}
