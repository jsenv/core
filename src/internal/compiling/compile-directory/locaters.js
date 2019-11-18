import { resolveFileUrl, resolveDirectoryUrl } from "internal/urlUtils.js"

export const resolveAssetFileUrl = ({ projectDirectoryUrl, compiledFileRelativePath, asset }) => {
  const assetDirectoryUrl = resolveDirectoryUrl(
    `${compiledFileRelativePath}__asset__/`,
    projectDirectoryUrl,
  )
  return resolveFileUrl(asset, assetDirectoryUrl)
}

export const resolveMetaJsonFileUrl = ({ projectDirectoryUrl, compiledFileRelativePath }) =>
  resolveAssetFileUrl({ projectDirectoryUrl, compiledFileRelativePath, asset: "meta.json" })

export const resolveCompiledFileUrl = ({ projectDirectoryUrl, compiledFileRelativePath }) =>
  resolveFileUrl(compiledFileRelativePath, projectDirectoryUrl)

export const resolveOriginalFileUrl = ({ projectDirectoryUrl, originalFileRelativePath }) =>
  resolveFileUrl(originalFileRelativePath, projectDirectoryUrl)

export const resolveSourceFileUrl = ({ projectDirectoryUrl, source }) =>
  resolveFileUrl(source, projectDirectoryUrl)
