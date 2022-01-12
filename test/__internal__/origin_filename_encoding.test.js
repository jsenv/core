import { assert } from "@jsenv/assert"

import {
  encodeOriginToFilename,
  decodeOriginFromFilename,
} from "@jsenv/core/src/internal/compiling/origin_filename_encoding.js"

{
  const origin = "http://google.com"
  const originAsFilename = encodeOriginToFilename(origin)
  const originDecoded = decodeOriginFromFilename(originAsFilename)
  const actual = {
    originAsFilename,
    originDecoded,
  }
  const expected = {
    originAsFilename: "http%3a%2f%2fgoogle.com",
    originDecoded: origin,
  }
  assert({ actual, expected })
}

{
  const origin = "https://cdn.skypack.dev"
  const originAsFilename = encodeOriginToFilename(origin)
  const originDecoded = decodeOriginFromFilename(originAsFilename)
  const actual = {
    originAsFilename,
    originDecoded,
  }
  const expected = {
    originAsFilename: "https%3a%2f%2fcdn.skypack.dev",
    originDecoded: origin,
  }
  assert({ actual, expected })
}
