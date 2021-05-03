import { urlToRelativeUrl, fileSystemPathToUrl } from "@jsenv/util"

export const makeIstanbulCoverageRelative = (istanbulCoverage, projectDirectoryUrl) => {
  const istanbulCoverageRelative = {}

  Object.keys(istanbulCoverage).forEach((key) => {
    const fileCoverage = istanbulCoverage[key]
    const relativeUrl = urlToRelativeUrl(
      fileSystemPathToUrl(fileCoverage.path),
      projectDirectoryUrl,
    )
    istanbulCoverageRelative[relativeUrl] = {
      ...fileCoverage,
      path: `./${relativeUrl}`,
    }
  })

  return istanbulCoverageRelative
}
