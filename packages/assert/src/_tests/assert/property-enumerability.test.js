import { assert } from "@jsenv/assert"
import { ensureAssertionErrorWithMessage } from "../ensureAssertionErrorWithMessage.js"

try {
  const actual = Object.defineProperty({}, "foo", { enumerable: true })
  const expected = Object.defineProperty({}, "foo", { enumerable: true })
  assert({ actual, expected })
} catch (e) {
  throw new Error(`should not throw`)
}

try {
  const actual = Object.defineProperty({}, "foo", { enumerable: false })
  const expected = Object.defineProperty({}, "foo", { enumerable: true })
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `unequal values
--- found ---
"non-enumerable"
--- expected ---
"enumerable"
--- path ---
actual.foo[[Enumerable]]`,
  )
}

try {
  const actual = Object.defineProperty({}, "foo", { enumerable: true })
  const expected = Object.defineProperty({}, "foo", { enumerable: false })
  assert({ actual, expected })
} catch (e) {
  ensureAssertionErrorWithMessage(
    e,
    `unequal values
--- found ---
"enumerable"
--- expected ---
"non-enumerable"
--- path ---
actual.foo[[Enumerable]]`,
  )
}
