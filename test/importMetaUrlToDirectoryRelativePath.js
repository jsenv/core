import { resolveDirectoryUrl, fileUrlToRelativePath } from "../src/urlHelpers.js"
import { jsenvCoreDirectoryUrl } from "../src/jsenvCoreDirectoryUrl/jsenvCoreDirectoryUrl.js"

export const importMetaUrlToDirectoryRelativePath = (importMetaUrl) => {
  const directoryUrl = resolveDirectoryUrl("./", importMetaUrl)
  const directoryRelativePath = fileUrlToRelativePath(directoryUrl, jsenvCoreDirectoryUrl)
  return directoryRelativePath
}
