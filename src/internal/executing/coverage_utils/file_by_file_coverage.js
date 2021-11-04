import {
  urlToRelativeUrl,
  fileSystemPathToUrl,
  isFileSystemPath,
  resolveUrl,
} from "@jsenv/filesystem"

export const normalizeFileByFileCoverage = (
  fileByFileCoverage,
  projectDirectoryUrl,
) => {
  const fileByFileNormalized = {}

  Object.keys(fileByFileCoverage).forEach((key) => {
    const fileCoverage = fileByFileCoverage[key]
    const { path } = fileCoverage
    const url = isFileSystemPath(path)
      ? fileSystemPathToUrl(path)
      : resolveUrl(path, projectDirectoryUrl)
    const relativeUrl = urlToRelativeUrl(url, projectDirectoryUrl)

    fileByFileNormalized[`./${relativeUrl}`] = {
      ...fileCoverage,
      path: `./${relativeUrl}`,
    }
  })

  return fileByFileNormalized
}
