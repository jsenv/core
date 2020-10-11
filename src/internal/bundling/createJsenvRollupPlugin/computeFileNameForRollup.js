import { createHash } from "crypto"
import { urlToPathname } from "./urlToPathname.js"
import { pathnameToExtension } from "./pathnameToExtension.js"
import { pathnameToBasename } from "./pathnameToBasename.js"

export const computeFileNameForRollup = (
  fileUrl,
  fileContent,
  pattern = "assets/[name]-[hash][extname]",
) => {
  const pathname = urlToPathname(fileUrl)

  const fileNameForRollup = renderNamePattern(pattern, {
    dirname: () => urlToParentUrl(fileUrl),
    name: () => pathnameToBasename(pathname),
    hash: () => generateAssetHash(fileContent),
    extname: () => pathnameToExtension(pathname),
  })
  return fileNameForRollup
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
