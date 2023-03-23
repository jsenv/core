import { assert } from "@jsenv/assert"
import { ensureAssertionErrorWithMessage } from "../ensureAssertionErrorWithMessage.js"
import { executeInNewContext } from "../executeInNewContext.js"

{
  const actual = {}
  const expected = {}
  assert({ actual, expected })
}

try {
  const ancestorPrototype = { ancestor: true }
  const directPrototype = Object.create(ancestorPrototype)
  directPrototype.direct = true

  const actual = Object.create(ancestorPrototype)
  const expected = Object.create(directPrototype)
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `unequal prototypes
--- prototype found ---
{
  "ancestor": true
}
--- prototype expected ---
{
  "direct": true
}
--- path ---
actual[[Prototype]]`,
  )
}

try {
  const ancestorAPrototype = { ancestorA: true }
  const ancestorBPrototype = { ancestorB: true }
  const childAPrototype = Object.create(ancestorAPrototype)
  childAPrototype.parentA = true
  const childBPrototype = Object.create(ancestorBPrototype)
  childBPrototype.parentB = true

  const actual = Object.create(childAPrototype)
  const expected = Object.create(childBPrototype)
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `unequal prototypes
--- prototype found ---
{
  "parentA": true
}
--- prototype expected ---
{
  "parentB": true
}
--- path ---
actual[[Prototype]]`,
  )
}

{
  const actual = await executeInNewContext("[]")
  const expected = []
  assert({ actual, expected })
}

if (typeof global === "object") {
  const actual = {}
  const expected = Object.create(null)
  try {
    assert({ actual, expected })
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `unequal prototypes
--- prototype found ---
global.Object.prototype
--- prototype expected ---
null
--- path ---
actual[[Prototype]]`,
    )
  }
}

if (typeof global === "object") {
  const actual = {
    value: Object.create(null),
  }
  const expected = {
    value: {},
  }
  try {
    assert({ actual, expected })
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `unequal prototypes
--- prototype found ---
null
--- prototype expected ---
global.Object.prototype
--- path ---
actual.value[[Prototype]]`,
    )
  }
}

if (typeof global === "object") {
  const prototype = {}
  const actual = prototype
  const expected = Object.create(prototype)
  try {
    assert({ actual, expected })
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `unequal prototypes
--- prototype found ---
global.Object.prototype
--- prototype expected ---
actual
--- path ---
actual[[Prototype]]`,
    )
  }
}

if (typeof global === "object") {
  const prototype = {}
  const actual = Object.create(prototype)
  const expected = prototype
  try {
    assert({ actual, expected })
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `unequal prototypes
--- prototype found ---
expected
--- prototype expected ---
global.Object.prototype
--- path ---
actual[[Prototype]]`,
    )
  }
}

if (typeof global === "object") {
  const prototype = null
  const actual = {}
  const expected = Object.create(prototype)
  try {
    assert({ actual, expected })
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `unequal prototypes
--- prototype found ---
global.Object.prototype
--- prototype expected ---
null
--- path ---
actual[[Prototype]]`,
    )
  }
}
