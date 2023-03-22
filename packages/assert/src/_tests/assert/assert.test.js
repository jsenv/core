import { assert } from "@jsenv/assert"
import { ensureErrorWithMessage } from "../ensureErrorWithMessage.js"

try {
  assert()
  throw new Error("should throw")
} catch (e) {
  ensureErrorWithMessage(
    e,
    `assert must be called with { actual, expected }, missing first argument`,
  )
}

try {
  assert(true, false)
  throw new Error("should throw")
} catch (e) {
  ensureErrorWithMessage(
    e,
    `assert must be called with { actual, expected }, received too many arguments`,
  )
}

try {
  // we could consider this call as valid
  // but people might think assert() signature is (actual, expected)
  // we have to throw in that case too to informe they are
  // doing something unexpected
  assert({ actual: true, expected: true }, false)
  throw new Error("should throw")
} catch (e) {
  ensureErrorWithMessage(
    e,
    `assert must be called with { actual, expected }, received too many arguments`,
  )
}

try {
  assert(null)
  throw new Error("should throw")
} catch (e) {
  ensureErrorWithMessage(
    e,
    `assert must be called with { actual, expected }, received null as first argument instead of object`,
  )
}

try {
  assert({ expected: undefined })
  throw new Error("should throw")
} catch (e) {
  ensureErrorWithMessage(
    e,
    `assert must be called with { actual, expected }, missing actual property on first argument`,
  )
}

try {
  assert({ actual: undefined })
  throw new Error("should throw")
} catch (e) {
  ensureErrorWithMessage(
    e,
    `assert must be called with { actual, expected }, missing expected property on first argument`,
  )
}
