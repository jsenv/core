import { resolveDirectoryUrl, resolveUrl, urlToFileSystemPath } from "@jsenv/util"

export const requireGlobalBundle = async ({
  projectDirectoryUrl,
  bundleDirectoryRelativeUrl,
  mainRelativeUrl,
  globalName,
}) => {
  const bundleDirectoryUrl = resolveDirectoryUrl(bundleDirectoryRelativeUrl, projectDirectoryUrl)
  const mainFileUrl = resolveUrl(mainRelativeUrl, bundleDirectoryUrl)
  const mainFilePath = urlToFileSystemPath(mainFileUrl)
  import.meta.require(mainFilePath)
  return {
    globalValue: global[globalName],
  }
}
