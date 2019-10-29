import { resolveFileUrl, resolveDirectoryUrl, fileUrlToPath } from "../urlHelpers.js"

export const getCacheFilePath = ({ cacheDirectoryUrl, compileRelativePath }) =>
  fileUrlToPath(resolveFileUrl(`${compileRelativePath}__asset__/cache.json`, cacheDirectoryUrl))

// the fact an asset filename is relative to projectPath + compiledpathnameRelative
// is strange considering a source filename is relative to projectPath
// I think it would make more sense to make them relative to the cache.json
// file itself but that's for later
export const getAssetFilePath = ({ cacheDirectoryUrl, compileRelativePath, asset }) => {
  const compiledFileUrl = resolveFileUrl(compileRelativePath, cacheDirectoryUrl)
  const compiledFileDirectoryUrl = resolveDirectoryUrl("./", compiledFileUrl)
  const assetFileUrl = resolveFileUrl(`./${asset}`, compiledFileDirectoryUrl)
  return fileUrlToPath(assetFileUrl)
}

export const getCompiledFilePath = ({ cacheDirectoryUrl, compileRelativePath }) =>
  fileUrlToPath(resolveFileUrl(compileRelativePath, cacheDirectoryUrl))

export const getSourceFilePath = ({ projectDirectoryUrl, sourceRelativePath }) =>
  fileUrlToPath(resolveFileUrl(projectDirectoryUrl, sourceRelativePath))
