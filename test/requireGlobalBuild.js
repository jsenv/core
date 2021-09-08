import { resolveDirectoryUrl, resolveUrl, urlToFileSystemPath } from "@jsenv/filesystem"
import { require } from "@jsenv/core/src/internal/require.js"

export const requireGlobalBuild = async ({
  projectDirectoryUrl,
  buildDirectoryRelativeUrl,
  mainRelativeUrl,
  globalName,
}) => {
  const buildDirectoryUrl = resolveDirectoryUrl(buildDirectoryRelativeUrl, projectDirectoryUrl)
  const mainFileUrl = resolveUrl(mainRelativeUrl, buildDirectoryUrl)
  const mainFilePath = urlToFileSystemPath(mainFileUrl)
  // eslint-disable-next-line import/no-dynamic-require
  require(mainFilePath)
  return {
    globalValue: global[globalName],
  }
}
