import { createHash } from "node:crypto"

import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js"
import { ensureUnixLineBreaks } from "./line_break_unix.js"

// https://github.com/rollup/rollup/blob/19e50af3099c2f627451a45a84e2fa90d20246d5/src/utils/FileEmitter.ts#L47
// https://github.com/rollup/rollup/blob/5a5391971d695c808eed0c5d7d2c6ccb594fc689/src/Chunk.ts#L870
export const createVersionGenerator = () => {
  const hash = createHash("sha256")

  return {
    augmentWithContent: ({
      content,
      contentType = "application/octet-stream",
      lineBreakNormalization = false,
    }) => {
      hash.update(
        lineBreakNormalization && CONTENT_TYPE.isTextual(contentType)
          ? ensureUnixLineBreaks(content)
          : content,
      )
    },
    augment: (value) => {
      hash.update(value)
    },
    generate: () => {
      return hash.digest("hex").slice(0, 8)
    },
  }
}
