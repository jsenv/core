import { resolveFileUrl, resolveDirectoryUrl } from "internal/urlUtils.js"

export const resolveAssetFileUrl = ({ projectDirectoryUrl, compiledFileRelativeUrl, asset }) => {
  const assetDirectoryUrl = resolveDirectoryUrl(
    `${compiledFileRelativeUrl}__asset__/`,
    projectDirectoryUrl,
  )
  return resolveFileUrl(asset, assetDirectoryUrl)
}

export const resolveMetaJsonFileUrl = ({ projectDirectoryUrl, compiledFileRelativeUrl }) =>
  resolveAssetFileUrl({ projectDirectoryUrl, compiledFileRelativeUrl, asset: "meta.json" })

export const resolveCompiledFileUrl = ({ projectDirectoryUrl, compiledFileRelativeUrl }) =>
  resolveFileUrl(compiledFileRelativeUrl, projectDirectoryUrl)

export const resolveOriginalFileUrl = ({ projectDirectoryUrl, originalFileRelativeUrl }) =>
  resolveFileUrl(originalFileRelativeUrl, projectDirectoryUrl)

export const resolveSourceFileUrl = ({ projectDirectoryUrl, source }) =>
  resolveFileUrl(source, projectDirectoryUrl)
