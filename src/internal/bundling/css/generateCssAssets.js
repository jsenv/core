import { extname, basename } from "path"
import { createHash } from "crypto"
import { readFile } from "fs"
import { urlToFileSystemPath, urlToRelativeUrl, resolveUrl } from "@jsenv/util"

export const fetchCssAssets = async (cssDependencies) => {
  const assetUrls = []
  Object.keys(cssDependencies).forEach((cssFileUrl) => {
    assetUrls.push(...cssDependencies[cssFileUrl].assetUrls)
  })

  const assetSources = {}

  await Promise.all(
    assetUrls.map(async (url) => {
      const assetSource = new Promise((resolve, reject) => {
        readFile(urlToFileSystemPath(url), (error, buffer) => {
          if (error) {
            reject(error)
          } else {
            resolve(buffer)
          }
        })
      })
      return assetSource
    }),
  )

  return assetSources
}

export const generateCssAssets = async (
  assetSources,
  { projectDirectoryUrl, bundleDirectoryUrl },
) => {
  const assetMappings = {}

  await Promise.all(
    Object.keys(assetSources).map(async (assetUrl) => {
      const assetSource = assetSources[assetUrl]
      const assetRelativeUrl = urlToRelativeUrl(assetUrl, projectDirectoryUrl)
      const assetParentUrl = urlToParentUrl(assetRelativeUrl)
      const assetFilename = renderNamePattern(`[name]-[hash][extname]`, {
        name: () => basename(assetRelativeUrl, extname(assetRelativeUrl)),
        hash: () => generateAssetHash(assetRelativeUrl, assetSource),
        extname: () => extname(assetRelativeUrl),
      })
      const assetBundleFileUrl = resolveUrl(`${assetParentUrl}${assetFilename}`, bundleDirectoryUrl)

      assetMappings[assetUrl] = assetBundleFileUrl
    }),
  )

  return assetMappings
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
