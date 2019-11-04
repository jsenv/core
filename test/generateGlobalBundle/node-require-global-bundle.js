import { resolveDirectoryUrl, resolveFileUrl, fileUrlToPath } from "../../src/urlHelpers.js"

export const nodeRequireGlobalBundle = async ({
  projectDirectoryUrl,
  bundleDirectoryRelativePath,
  mainRelativePath,
  globalName,
}) => {
  const bundleDirectoryUrl = resolveDirectoryUrl(bundleDirectoryRelativePath, projectDirectoryUrl)
  const mainFileUrl = resolveFileUrl(mainRelativePath, bundleDirectoryUrl)
  const mainFilePath = fileUrlToPath(mainFileUrl)
  import.meta.require(mainFilePath)
  return {
    globalValue: global[globalName],
  }
}
