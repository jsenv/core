import { metaMapToSpecifierMetaMap } from "@jsenv/url-meta"
import { collectFiles } from "@jsenv/file-collector"
import { fileUrlToPath } from "internal/urlUtils.js"
import { relativeUrlToEmptyCoverage } from "./relativeUrlToEmptyCoverage.js"
import { composeCoverageMap } from "./composeCoverageMap.js"

export const reportToCoverageMap = async (
  report,
  {
    cancellationToken,
    projectDirectoryUrl,
    babelPluginMap,
    coverageConfig,
    coverageIncludeMissing,
  },
) => {
  const coverageMapForReport = executionReportToCoverageMap(report)

  if (!coverageIncludeMissing) {
    return coverageMapForReport
  }

  const relativeFileUrlToCoverArray = await listRelativeFileUrlToCover({
    cancellationToken,
    projectDirectoryUrl,
    coverageConfig,
  })

  const relativeFileUrlMissingCoverageArray = relativeFileUrlToCoverArray.filter(
    (relativeFileUrlToCover) => relativeFileUrlToCover in coverageMapForReport === false,
  )

  const coverageMapForMissedFiles = {}
  await Promise.all(
    relativeFileUrlMissingCoverageArray.map(async (relativeFileUrlMissingCoverage) => {
      const emptyCoverage = await relativeUrlToEmptyCoverage(relativeFileUrlMissingCoverage, {
        cancellationToken,
        projectDirectoryUrl,
        babelPluginMap,
      })
      coverageMapForMissedFiles[relativeFileUrlMissingCoverage] = emptyCoverage
      return emptyCoverage
    }),
  )

  return {
    ...coverageMapForReport,
    ...coverageMapForMissedFiles,
  }
}

const listRelativeFileUrlToCover = async ({
  cancellationToken,
  projectDirectoryUrl,
  coverageConfig,
}) => {
  const specifierMetaMapForCoverage = metaMapToSpecifierMetaMap({
    cover: coverageConfig,
  })

  const matchingFileResultArray = await collectFiles({
    cancellationToken,
    directoryPath: fileUrlToPath(projectDirectoryUrl),
    specifierMetaMap: specifierMetaMapForCoverage,
    predicate: ({ cover }) => cover,
  })

  return matchingFileResultArray.map(({ relativeUrl }) => relativeUrl)
}

const executionReportToCoverageMap = (report) => {
  const coverageMapArray = []

  Object.keys(report).forEach((file) => {
    const executionResultForFile = report[file]
    Object.keys(executionResultForFile).forEach((executionName) => {
      const executionResultForFileOnPlatform = executionResultForFile[executionName]

      const { coverageMap } = executionResultForFileOnPlatform
      if (!coverageMap) {
        // several reasons not to have coverageMap here:
        // 1. the file we executed did not import an instrumented file.
        // - a test file without import
        // - a test file importing only file excluded from coverage
        // - a coverDescription badly configured so that we don't realize
        // a file should be covered

        // 2. the file we wanted to executed timedout
        // - infinite loop
        // - too extensive operation
        // - a badly configured or too low allocatedMs for that execution.

        // 3. the file we wanted to execute contains syntax-error

        // in any scenario we are fine because
        // coverDescription will generate empty coverage for files
        // that were suppose to be coverage but were not.
        return
      }

      coverageMapArray.push(coverageMap)
    })
  })

  const executionCoverageMap = composeCoverageMap(...coverageMapArray)

  return executionCoverageMap
}
