import { assert } from "@jsenv/assert"
import { ensureAssertionErrorWithMessage } from "../ensureAssertionErrorWithMessage.js"

{
  const actual = {
    foo: true,
    bar: true,
  }
  const expected = {
    foo: true,
    bar: true,
  }
  assert({ actual, expected })
}

{
  const actual = {
    foo: true,
    bar: true,
  }
  const expected = {
    bar: true,
    foo: true,
  }
  try {
    assert({ actual, expected })
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `unexpected properties order
--- properties order found ---
"foo"
"bar"
--- properties order expected ---
"bar"
"foo"
--- path ---
actual`,
    )
  }
}

// properties order is only on enumerable properties
// this is because code is unlikely going to rely on non enumerable property order
// it also fixes an strange issue on webkit where
// Object.getOwnPropertyNames(function() {}) inconsistently returns either
// ["name", "prototype", "length"]
// or
// ["length", "name", "prototype"]
{
  const actual = {}
  Object.defineProperty(actual, "bar", { enumerable: false })
  Object.defineProperty(actual, "foo", { enumerable: false })
  const expected = {}
  Object.defineProperty(expected, "foo", { enumerable: false })
  Object.defineProperty(expected, "bar", { enumerable: false })
  assert({ actual, expected })
}
