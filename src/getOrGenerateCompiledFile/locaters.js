import { resolveFileUrl, fileUrlToPath, resolveDirectoryUrl } from "../urlHelpers.js"

export const getPathForAssetFile = ({
  compileDirectoryUrl,
  relativePathToCompileDirectory,
  asset,
}) => {
  const assetDirectoryUrl = resolveDirectoryUrl(
    `${relativePathToCompileDirectory}__asset__/`,
    compileDirectoryUrl,
  )
  const assetFileUrl = resolveFileUrl(asset, assetDirectoryUrl)
  return fileUrlToPath(assetFileUrl)
}

export const getPathForMetaJsonFile = ({ compileDirectoryUrl, relativePathToCompileDirectory }) =>
  getPathForAssetFile({ compileDirectoryUrl, relativePathToCompileDirectory, asset: "meta.json" })

export const getPathForCompiledFile = ({ compileDirectoryUrl, relativePathToCompileDirectory }) =>
  fileUrlToPath(resolveFileUrl(relativePathToCompileDirectory, compileDirectoryUrl))

export const getPathForOriginalFile = ({ projectDirectoryUrl, relativePathToProjectDirectory }) =>
  fileUrlToPath(resolveFileUrl(relativePathToProjectDirectory, projectDirectoryUrl))

export const getPathForSourceFile = ({ projectDirectoryUrl, source }) =>
  fileUrlToPath(resolveFileUrl(source, projectDirectoryUrl))
