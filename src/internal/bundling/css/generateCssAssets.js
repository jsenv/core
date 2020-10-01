import { extname, basename } from "path"
import { createHash } from "crypto"
import { urlToRelativeUrl, resolveUrl } from "@jsenv/util"

export const generateCssAssets = (
  cssDependencyMap,
  { projectDirectoryUrl, bundleDirectoryUrl },
) => {
  const assets = {}
  Object.keys(cssDependencyMap).forEach((fileUrl) => {
    const fileInfo = cssDependencyMap[fileUrl]
    if (fileInfo.type === "asset") {
      const assetFileUrl = fileInfo.url
      const assetRelativeUrl = urlToRelativeUrl(assetFileUrl, projectDirectoryUrl)
      const assetParentUrl = urlToParentUrl(assetRelativeUrl)
      const assetFilename = renderNamePattern(`[name]-[hash][extname]`, {
        name: () => basename(assetRelativeUrl, extname(assetRelativeUrl)),
        hash: () => generateAssetHash(assetRelativeUrl, fileInfo.source),
        extname: () => extname(assetRelativeUrl),
      })
      const assetBundleFileUrl = resolveUrl(`${assetParentUrl}${assetFilename}`, bundleDirectoryUrl)
      assets[assetFileUrl] = assetBundleFileUrl
    }
  })
  return assets
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
const generateAssetHash = (assetRelativeUrl, assetSource) => {
  const hash = createHash("sha256")
  hash.update(assetRelativeUrl)
  hash.update(":")
  hash.update(assetSource)
  return hash.digest("hex").slice(0, 8)
}
