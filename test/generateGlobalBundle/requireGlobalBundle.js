import { resolveDirectoryUrl, resolveFileUrl, fileUrlToPath } from "src/internal/urlUtils.js"

export const requireGlobalBundle = async ({
  projectDirectoryUrl,
  bundleDirectoryRelativeUrl,
  mainRelativePath,
  globalName,
}) => {
  const bundleDirectoryUrl = resolveDirectoryUrl(bundleDirectoryRelativeUrl, projectDirectoryUrl)
  const mainFileUrl = resolveFileUrl(mainRelativePath, bundleDirectoryUrl)
  const mainFilePath = fileUrlToPath(mainFileUrl)
  import.meta.require(mainFilePath)
  return {
    globalValue: global[globalName],
  }
}
