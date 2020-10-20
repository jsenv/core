import { createHash } from "crypto"
import { urlToParentUrl, urlToBasename, urlToExtension } from "@jsenv/util"
import { renderNamePattern } from "../renderNamePattern.js"

export const computeFileNameForRollup = (
  fileUrl,
  fileContent,
  pattern = "assets/[name]-[hash][extname]",
) => {
  const fileNameForRollup = renderNamePattern(typeof pattern === "function" ? pattern() : pattern, {
    dirname: () => urlToParentUrl(fileUrl),
    name: () => urlToBasename(fileUrl),
    hash: () => generateAssetHash(fileContent),
    extname: () => urlToExtension(fileUrl),
  })
  return fileNameForRollup
}

// https://github.com/rollup/rollup/blob/19e50af3099c2f627451a45a84e2fa90d20246d5/src/utils/FileEmitter.ts#L47
const generateAssetHash = (assetSource) => {
  const hash = createHash("sha256")
  hash.update(assetSource)
  return hash.digest("hex").slice(0, 8)
}
