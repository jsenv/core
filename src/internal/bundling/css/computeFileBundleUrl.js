import { extname, basename } from "path"
import { createHash } from "crypto"
import { urlToRelativeUrl, resolveUrl } from "@jsenv/util"

export const computeFileBundleUrl = (
  fileUrl,
  { pattern = `[name]-[hash][extname]`, fileContent, projectDirectoryUrl, bundleDirectoryUrl },
) => {
  const fileRelativeUrl = urlToRelativeUrl(fileUrl, projectDirectoryUrl)
  const fileParentUrl = urlToParentUrl(fileRelativeUrl)
  const assetFilename = renderNamePattern(pattern, {
    name: () => basename(fileRelativeUrl, extname(fileRelativeUrl)),
    hash: () => generateAssetHash(fileContent),
    extname: () => extname(fileRelativeUrl),
  })
  const bundleFileUrl = resolveUrl(`${fileParentUrl}${assetFilename}`, bundleDirectoryUrl)
  return bundleFileUrl
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
