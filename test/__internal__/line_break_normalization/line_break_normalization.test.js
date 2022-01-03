import { assert } from "@jsenv/assert"
import { readFile, resolveUrl } from "@jsenv/filesystem"

import { generateContentHash } from "@jsenv/core/src/internal/building/url_versioning.js"

const stringWithUnixLineBreak = `console.log(42);\n`
const stringWithWindowsLineBreak = `console.log(42);\r\n`
{
  const hashForUnixStringWithoutNormalization = generateContentHash(
    stringWithUnixLineBreak,
    {
      lineBreakNormalization: false,
      contentType: "application/javascript",
    },
  )
  const hashForWindowsStringWithoutNormalization = generateContentHash(
    stringWithWindowsLineBreak,
    {
      lineBreakNormalization: false,
      contentType: "application/javascript",
    },
  )
  const hashForUnixStringWithNormalization = generateContentHash(
    stringWithUnixLineBreak,
    {
      lineBreakNormalization: true,
      contentType: "application/javascript",
    },
  )
  const hashForWindowsStringWithNormalization = generateContentHash(
    stringWithWindowsLineBreak,
    {
      lineBreakNormalization: true,
      contentType: "application/javascript",
    },
  )

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
  const hashForUnixBufferWithoutNormalization = generateContentHash(
    bufferWithUnixLineBreak,
    {
      lineBreakNormalization: false,
      contentType: "application/javascript",
    },
  )
  const hashForWindowsBufferWithoutNormalization = generateContentHash(
    bufferWithWindowsLineBreak,
    {
      lineBreakNormalization: false,
      contentType: "application/javascript",
    },
  )
  const hashForUnixBufferWithNormalization = generateContentHash(
    bufferWithUnixLineBreak,
    {
      lineBreakNormalization: true,
      contentType: "application/javascript",
    },
  )
  const hashForWindowsBufferWithNormalization = generateContentHash(
    bufferWithWindowsLineBreak,
    {
      lineBreakNormalization: true,
      contentType: "application/javascript",
    },
  )

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

// lineBreakNormalization disabled when content type is not textual
// (for instance an image)
{
  const imageBuffer = await readFile(
    resolveUrl("./image.png", import.meta.url),
    { as: "buffer" },
  )
  const hashForImageBufferRecognizedAsImage = generateContentHash(imageBuffer, {
    lineBreakNormalization: true,
    contentType: "image/png",
  })
  const hashForImageBufferRecognizedAsHtml = generateContentHash(imageBuffer, {
    lineBreakNormalization: true,
    contentType: "text/html",
  })

  const actual = {
    hashForImageBufferRecognizedAsImage,
    hashForImageBufferRecognizedAsHtml,
  }
  const expected = {
    hashForImageBufferRecognizedAsImage: "574c1c76",
    hashForImageBufferRecognizedAsHtml: "f649d8e3",
  }
  assert({ actual, expected })
}
