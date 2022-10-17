import { assert } from "@jsenv/assert"
import { ensureAssertionErrorWithMessage } from "@jsenv/assert/tests/ensureAssertionErrorWithMessage.js"

{
  const actual = {}
  actual.self = actual
  const expected = {}
  expected.self = expected
  assert({ actual, expected })
}

{
  const actual = {}
  actual.object = { parent: actual }
  const expected = {}
  expected.object = { parent: expected }
  assert({ actual, expected })
}

{
  const actual = {}
  actual.object = { self: actual, self2: actual }
  const expected = {}
  expected.object = { self: expected, self2: expected }
  assert({ actual, expected })
}

{
  const actual = {}
  actual.object = { self: actual, self2: actual }
  const expected = {}
  expected.object = { self: expected, self2: expected }

  assert({ actual, expected })
}

try {
  const actual = {}
  actual.self = {}
  const expected = {}
  expected.self = expected
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `found a value instead of a reference
--- value found ---
{}
--- reference expected to ---
expected
--- path ---
actual.self`,
  )
}

try {
  const actual = {}
  actual.self = actual
  const expected = {}
  expected.self = {}
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `found a reference instead of a value
--- reference found to ---
actual
--- value expected ---
{}
--- path ---
actual.self`,
  )
}

try {
  const actual = {
    object: {},
  }
  actual.object.self = {}
  const expected = {
    object: {},
  }
  expected.object.self = expected.object
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `found a value instead of a reference
--- value found ---
{}
--- reference expected to ---
expected.object
--- path ---
actual.object.self`,
  )
}

try {
  const actual = {
    object: {},
  }
  actual.object.self = actual
  const expected = {
    object: {},
  }
  expected.object.self = expected.object
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `unequal references
--- reference found to ---
actual
--- reference expected to ---
expected.object
--- path ---
actual.object.self`,
  )
}
