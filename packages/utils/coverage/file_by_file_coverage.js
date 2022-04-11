import {
  urlToRelativeUrl,
  fileSystemPathToUrl,
  isFileSystemPath,
  resolveUrl,
} from "@jsenv/filesystem"

export const normalizeFileByFileCoveragePaths = (
  fileByFileCoverage,
  rootDirectoryUrl,
) => {
  const fileByFileNormalized = {}
  Object.keys(fileByFileCoverage).forEach((key) => {
    const fileCoverage = fileByFileCoverage[key]
    const { path } = fileCoverage
    const url = isFileSystemPath(path)
      ? fileSystemPathToUrl(path)
      : resolveUrl(path, rootDirectoryUrl)
    const relativeUrl = urlToRelativeUrl(url, rootDirectoryUrl)
    fileByFileNormalized[`./${relativeUrl}`] = {
      ...fileCoverage,
      path: `./${relativeUrl}`,
    }
  })
  return fileByFileNormalized
}
