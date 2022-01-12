import { assert } from "@jsenv/assert"

import { originDirectoryConverter } from "@jsenv/core/src/internal/compiling/origin_directory_converter.js"

{
  const origin = "http://google.com"
  const originAsDirectoryName = originDirectoryConverter.toDirectoryName(origin)
  const originDecoded = originDirectoryConverter.fromDirectoryName(
    originAsDirectoryName,
  )
  const actual = {
    originAsDirectoryName,
    originDecoded,
  }
  const expected = {
    originAsDirectoryName: "http$3a$2f$2fgoogle.com",
    originDecoded: origin,
  }
  assert({ actual, expected })
}

{
  const origin = "https://cdn.skypack.dev"
  const originAsDirectoryName = originDirectoryConverter.toDirectoryName(origin)
  const originDecoded = originDirectoryConverter.fromDirectoryName(
    originAsDirectoryName,
  )
  const actual = {
    originAsDirectoryName,
    originDecoded,
  }
  const expected = {
    originAsDirectoryName: "https$3a$2f$2fcdn.skypack.dev",
    originDecoded: origin,
  }
  assert({ actual, expected })
}
