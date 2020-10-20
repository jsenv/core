import { resolveDirectoryUrl, resolveUrl, urlToFileSystemPath } from "@jsenv/util"
import { require } from "@jsenv/core/src/internal/require.js"

export const requireGlobalBundle = async ({
  projectDirectoryUrl,
  bundleDirectoryRelativeUrl,
  mainRelativeUrl,
  globalName,
}) => {
  const bundleDirectoryUrl = resolveDirectoryUrl(bundleDirectoryRelativeUrl, projectDirectoryUrl)
  const mainFileUrl = resolveUrl(mainRelativeUrl, bundleDirectoryUrl)
  const mainFilePath = urlToFileSystemPath(mainFileUrl)
  // eslint-disable-next-line import/no-dynamic-require
  require(mainFilePath)
  return {
    globalValue: global[globalName],
  }
}
