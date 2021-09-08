import { createHash } from "crypto"
import { urlToParentUrl, urlToBasename, urlToExtension } from "@jsenv/filesystem"
import { renderNamePattern } from "../renderNamePattern.js"

export const computeBuildRelativeUrl = (
  fileUrl,
  fileContent,
  {
    pattern = "[name]-[hash][extname]",
    contentType = "application/octet-stream",
    lineBreakNormalization = false,
  } = {},
) => {
  const buildRelativeUrl = renderNamePattern(typeof pattern === "function" ? pattern() : pattern, {
    dirname: () => urlToParentUrl(fileUrl),
    name: () => urlToBasename(fileUrl),
    hash: () => generateContentHash(fileContent, { contentType, lineBreakNormalization }),
    extname: () => urlToExtension(fileUrl),
  })
  return buildRelativeUrl
}

// https://github.com/rollup/rollup/blob/19e50af3099c2f627451a45a84e2fa90d20246d5/src/utils/FileEmitter.ts#L47
export const generateContentHash = (
  stringOrBuffer,
  { contentType = "application/octet-stream", lineBreakNormalization = false } = {},
) => {
  const hash = createHash("sha256")
  hash.update(
    lineBreakNormalization && contentTypeIsTextual(contentType)
      ? normalizeLineBreaks(stringOrBuffer)
      : stringOrBuffer,
  )
  return hash.digest("hex").slice(0, 8)
}

const contentTypeIsTextual = (contentType) => {
  if (contentType.startsWith("text/")) {
    return true
  }
  // catch things like application/manifest+json, application/importmap+json
  if (/^application\/\w+\+json$/.test(contentType)) {
    return true
  }
  if (CONTENT_TYPE_AS_TEXT.includes(contentType)) {
    return true
  }
  return false
}

const CONTENT_TYPE_AS_TEXT = ["application/javascript", "application/json", "image/svg+xml"]

const normalizeLineBreaks = (stringOrBuffer) => {
  if (typeof stringOrBuffer === "string") {
    return stringOrBuffer.replace(/\r\n/g, "\n")
  }
  return normalizeLineBreaksForBuffer(stringOrBuffer)
}

// https://github.com/nodejs/help/issues/1738#issuecomment-458460503
const normalizeLineBreaksForBuffer = (buffer) => {
  const int32Array = new Int32Array(buffer, 0, buffer.length)
  const int32ArrayWithLineBreaksNormalized = int32Array.filter((element, index, typedArray) => {
    if (element === 0x0d) {
      if (typedArray[index + 1] === 0x0a) {
        // Windows -> Unix
        return false
      }
      // Mac OS -> Unix
      typedArray[index] = 0x0a
    }
    return true
  })
  return Buffer.from(int32ArrayWithLineBreaksNormalized)
}
