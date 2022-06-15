import { assert } from "@jsenv/assert"

import { assertUrlLike } from "@jsenv/urls/src/meta/assertions.js"

try {
  assertUrlLike(["123"])
  throw new Error("shoud crash")
} catch (error) {
  const actual = error
  const expected = new TypeError(`url must be a url string, got 123`)
  assert({ actual, expected })
}

try {
  assertUrlLike("*$^=")
  throw new Error("shoud crash")
} catch (error) {
  const actual = error
  const expected = new TypeError(
    `url must be a url and no scheme found, got *$^=`,
  )
  assert({ actual, expected })
}
