import { resolveFileUrl, fileUrlToPath, resolveDirectoryUrl } from "../urlHelpers.js"

export const getAssetFilePath = ({ cacheDirectoryUrl, compileRelativePath, asset }) => {
  const assetDirectoryUrl = resolveDirectoryUrl(
    `${compileRelativePath}__asset__/`,
    cacheDirectoryUrl,
  )
  const assetFileUrl = resolveFileUrl(asset, assetDirectoryUrl)
  return fileUrlToPath(assetFileUrl)
}

export const getCacheJsonFilePath = ({ cacheDirectoryUrl, compileRelativePath }) =>
  getAssetFilePath({ cacheDirectoryUrl, compileRelativePath, asset: "cache.json" })

export const getCompiledFilePath = ({ cacheDirectoryUrl, compileRelativePath }) =>
  fileUrlToPath(resolveFileUrl(compileRelativePath, cacheDirectoryUrl))

export const getSourceFilePath = ({ projectDirectoryUrl, sourceRelativePath }) =>
  fileUrlToPath(resolveFileUrl(projectDirectoryUrl, sourceRelativePath))
