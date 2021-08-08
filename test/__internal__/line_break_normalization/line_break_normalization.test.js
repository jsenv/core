import { assert } from "@jsenv/assert"
import { generateContentHash } from "@jsenv/core/src/internal/building/url-versioning.js"

const stringWithUnixLineBreak = `console.log(42);\n`
const stringWithWindowsLineBreak = `console.log(42);\r\n`

{
  const hashForUnixStringWithoutNormalization = generateContentHash(stringWithUnixLineBreak, {
    lineBreakNormalization: false,
  })
  const hashForWindowsStringWithoutNormalization = generateContentHash(stringWithWindowsLineBreak, {
    lineBreakNormalization: false,
  })
  const hashForUnixStringWithNormalization = generateContentHash(stringWithUnixLineBreak, {
    lineBreakNormalization: true,
  })
  const hashForWindowsStringWithNormalization = generateContentHash(stringWithWindowsLineBreak, {
    lineBreakNormalization: true,
  })

  const actual = {
    hashForUnixStringWithoutNormalization,
    hashForWindowsStringWithoutNormalization,
    hashForUnixStringWithNormalization,
    hashForWindowsStringWithNormalization,
  }
  const expected = {
    hashForUnixStringWithoutNormalization: "7df141f2",
    hashForWindowsStringWithoutNormalization: "fda1b59e",
    hashForUnixStringWithNormalization: "7df141f2",
    hashForWindowsStringWithNormalization: "7df141f2",
  }
  assert({ actual, expected })
}

const bufferWithUnixLineBreak = Buffer.from(stringWithUnixLineBreak)
const bufferWithWindowsLineBreak = Buffer.from(stringWithWindowsLineBreak)
{
  const hashForUnixBufferWithoutNormalization = generateContentHash(bufferWithUnixLineBreak, {
    lineBreakNormalization: false,
  })
  const hashForWindowsBufferWithoutNormalization = generateContentHash(bufferWithWindowsLineBreak, {
    lineBreakNormalization: false,
  })
  const hashForUnixBufferWithNormalization = generateContentHash(bufferWithUnixLineBreak, {
    lineBreakNormalization: true,
  })
  const hashForWindowsBufferWithNormalization = generateContentHash(bufferWithWindowsLineBreak, {
    lineBreakNormalization: true,
  })

  const actual = {
    hashForUnixBufferWithoutNormalization,
    hashForWindowsBufferWithoutNormalization,
    hashForUnixBufferWithNormalization,
    hashForWindowsBufferWithNormalization,
  }
  const expected = {
    hashForUnixBufferWithoutNormalization: "7df141f2",
    hashForWindowsBufferWithoutNormalization: "fda1b59e",
    hashForUnixBufferWithNormalization: "7df141f2",
    hashForWindowsBufferWithNormalization: "7df141f2",
  }
  assert({ actual, expected })
}
