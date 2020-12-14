import { createHash } from "crypto"
import { urlToParentUrl, urlToBasename, urlToExtension } from "@jsenv/util"
import { renderNamePattern } from "../renderNamePattern.js"

export const computeBuildRelativeUrl = (
  fileUrl,
  fileContent,
  pattern = "[name]-[hash][extname]",
) => {
  const buildRelativeUrl = renderNamePattern(typeof pattern === "function" ? pattern() : pattern, {
    dirname: () => urlToParentUrl(fileUrl),
    name: () => urlToBasename(fileUrl),
    hash: () => generateHash(fileContent),
    extname: () => urlToExtension(fileUrl),
  })
  return buildRelativeUrl
}

// https://github.com/rollup/rollup/blob/19e50af3099c2f627451a45a84e2fa90d20246d5/src/utils/FileEmitter.ts#L47
export const generateHash = (stringOrBuffer) => {
  const hash = createHash("sha256")
  hash.update(stringOrBuffer)
  return hash.digest("hex").slice(0, 8)
}
