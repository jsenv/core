import { resolveFileUrl, fileUrlToPath, resolveDirectoryUrl } from "internal/urlUtils.js"

export const getPathForAssetFile = ({ projectDirectoryUrl, compiledFileRelativePath, asset }) => {
  const assetDirectoryUrl = resolveDirectoryUrl(
    `${compiledFileRelativePath}__asset__/`,
    projectDirectoryUrl,
  )
  const assetFileUrl = resolveFileUrl(asset, assetDirectoryUrl)
  return fileUrlToPath(assetFileUrl)
}

export const getPathForMetaJsonFile = ({ projectDirectoryUrl, compiledFileRelativePath }) =>
  getPathForAssetFile({ projectDirectoryUrl, compiledFileRelativePath, asset: "meta.json" })

export const getPathForCompiledFile = ({ projectDirectoryUrl, compiledFileRelativePath }) =>
  fileUrlToPath(resolveFileUrl(compiledFileRelativePath, projectDirectoryUrl))

export const getPathForOriginalFile = ({ projectDirectoryUrl, originalFileRelativePath }) =>
  fileUrlToPath(resolveFileUrl(originalFileRelativePath, projectDirectoryUrl))

export const getPathForSourceFile = ({ projectDirectoryUrl, source }) =>
  fileUrlToPath(resolveFileUrl(source, projectDirectoryUrl))
