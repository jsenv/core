import { urlToRelativeUrl, fileSystemPathToUrl, isFileSystemPath, resolveUrl } from "@jsenv/util"

export const normalizeIstanbulCoverage = (istanbulCoverage, projectDirectoryUrl) => {
  const istanbulCoverageNormalized = {}

  Object.keys(istanbulCoverage).forEach((key) => {
    const fileCoverage = istanbulCoverage[key]
    const { path } = fileCoverage
    const url = isFileSystemPath(path)
      ? fileSystemPathToUrl(path)
      : resolveUrl(path, projectDirectoryUrl)
    const relativeUrl = urlToRelativeUrl(url, projectDirectoryUrl)

    istanbulCoverageNormalized[`./${relativeUrl}`] = {
      ...fileCoverage,
      path: `./${relativeUrl}`,
    }
  })

  return istanbulCoverageNormalized
}
