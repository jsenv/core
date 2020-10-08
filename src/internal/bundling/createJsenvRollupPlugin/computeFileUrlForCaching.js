import { extname, basename } from "path"
import { createHash } from "crypto"
import { urlToFileSystemPath } from "@jsenv/util"

export const computeFileUrlForCaching = (
  fileUrl,
  fileContent,
  pattern = "[dirname][name]-[hash][extname]",
) => {
  const filePath = urlToFileSystemPath(fileUrl)
  const fileParentUrl = urlToParentUrl(fileUrl)
  const urlForCaching = renderNamePattern(pattern, {
    dirname: () => fileParentUrl,
    name: () => basename(filePath, extname(filePath)),
    hash: () => generateAssetHash(fileContent),
    extname: () => extname(filePath),
  })
  return urlForCaching
}

const urlToParentUrl = (url) => {
  const slashLastIndex = url.lastIndexOf("/")
  if (slashLastIndex === -1) return ""

  return url.slice(0, slashLastIndex + 1)
}

const renderNamePattern = (pattern, replacements) => {
  return pattern.replace(/\[(\w+)\]/g, (_match, type) => {
    const replacement = replacements[type]()
    return replacement
  })
}

// https://github.com/rollup/rollup/blob/19e50af3099c2f627451a45a84e2fa90d20246d5/src/utils/FileEmitter.ts#L47
const generateAssetHash = (assetSource) => {
  const hash = createHash("sha256")
  hash.update(assetSource)
  return hash.digest("hex").slice(0, 8)
}
