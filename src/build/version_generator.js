import { createHash } from "node:crypto"

import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js"

// https://github.com/rollup/rollup/blob/19e50af3099c2f627451a45a84e2fa90d20246d5/src/utils/FileEmitter.ts#L47
// https://github.com/rollup/rollup/blob/5a5391971d695c808eed0c5d7d2c6ccb594fc689/src/Chunk.ts#L870
export const createVersionGenerator = () => {
  const hash = createHash("sha256")

  const augmentWithContent = ({
    content,
    contentType = "application/octet-stream",
    lineBreakNormalization = false,
  }) => {
    hash.update(
      lineBreakNormalization && CONTENT_TYPE.isTextual(contentType)
        ? normalizeLineBreaks(content)
        : content,
    )
  }

  const augmentWithDependencyVersion = (version) => {
    hash.update(version)
  }

  return {
    augmentWithContent,
    augmentWithDependencyVersion,
    generate: () => {
      return hash.digest("hex").slice(0, 8)
    },
  }
}

const normalizeLineBreaks = (stringOrBuffer) => {
  if (typeof stringOrBuffer === "string") {
    const stringWithLinuxBreaks = stringOrBuffer.replace(/\r\n/g, "\n")
    return stringWithLinuxBreaks
  }
  return normalizeLineBreaksForBuffer(stringOrBuffer)
}

// https://github.com/nodejs/help/issues/1738#issuecomment-458460503
const normalizeLineBreaksForBuffer = (buffer) => {
  const int32Array = new Int32Array(buffer, 0, buffer.length)
  const int32ArrayWithLineBreaksNormalized = int32Array.filter(
    (element, index, typedArray) => {
      if (element === 0x0d) {
        if (typedArray[index + 1] === 0x0a) {
          // Windows -> Unix
          return false
        }
        // Mac OS -> Unix
        typedArray[index] = 0x0a
      }
      return true
    },
  )
  return Buffer.from(int32ArrayWithLineBreaksNormalized)
}
