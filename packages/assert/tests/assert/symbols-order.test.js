import { assert } from "@jsenv/assert"
import { ensureAssertionErrorWithMessage } from "@jsenv/assert/tests/ensureAssertionErrorWithMessage.js"

{
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
}

{
  const symbola = Symbol("a")
  const symbolb = Symbol("b")

  const actual = {
    [symbolb]: true,
    [symbola]: true,
  }
  const expected = {
    [symbola]: true,
    [symbolb]: true,
  }
  try {
    assert({ actual, expected })
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `unexpected symbols order
--- symbols order found ---
Symbol("b")
Symbol("a")
--- symbols order expected ---
Symbol("a")
Symbol("b")
--- path ---
actual`,
    )
  }
}
