import { collectFiles } from "@jsenv/util"
import { relativeUrlToEmptyCoverage } from "./relativeUrlToEmptyCoverage.js"
import { composeIstanbulCoverages } from "./composeIstanbulCoverages.js"
import { normalizeIstanbulCoverage } from "./normalizeIstanbulCoverage.js"

export const reportToCoverage = async (
  report,
  {
    logger,
    cancellationToken,
    projectDirectoryUrl,
    babelPluginMap,
    coverageConfig,
    coverageIncludeMissing,
    coverageV8MergeConflictIsExpected,
  },
) => {
  const istanbulCoverageFromExecution = executionReportToCoverage(report, {
    logger,
    projectDirectoryUrl,
    coverageV8MergeConflictIsExpected,
  })

  if (!coverageIncludeMissing) {
    return istanbulCoverageFromExecution
  }

  const relativeFileUrlToCoverArray = await listRelativeFileUrlToCover({
    cancellationToken,
    projectDirectoryUrl,
    coverageConfig,
  })

  const relativeFileUrlMissingCoverageArray = relativeFileUrlToCoverArray.filter(
    (relativeFileUrlToCover) =>
      Object.keys(istanbulCoverageFromExecution).every((key) => {
        return key !== `./${relativeFileUrlToCover}`
      }),
  )

  const istanbulCoverageFromMissedFiles = {}
  await Promise.all(
    relativeFileUrlMissingCoverageArray.map(async (relativeFileUrlMissingCoverage) => {
      const emptyCoverage = await relativeUrlToEmptyCoverage(relativeFileUrlMissingCoverage, {
        cancellationToken,
        projectDirectoryUrl,
        babelPluginMap,
      })
      istanbulCoverageFromMissedFiles[relativeFileUrlMissingCoverage] = emptyCoverage
      return emptyCoverage
    }),
  )

  return {
    ...istanbulCoverageFromExecution, // already normalized
    ...normalizeIstanbulCoverage(istanbulCoverageFromMissedFiles, projectDirectoryUrl),
  }
}

const listRelativeFileUrlToCover = async ({
  cancellationToken,
  projectDirectoryUrl,
  coverageConfig,
}) => {
  const structuredMetaMapForCoverage = {
    cover: coverageConfig,
  }

  const matchingFileResultArray = await collectFiles({
    cancellationToken,
    directoryUrl: projectDirectoryUrl,
    structuredMetaMap: structuredMetaMapForCoverage,
    predicate: ({ cover }) => cover,
  })

  return matchingFileResultArray.map(({ relativeUrl }) => relativeUrl)
}

const executionReportToCoverage = (
  report,
  { logger, projectDirectoryUrl, coverageV8MergeConflictIsExpected },
) => {
  const istanbulCoverages = []

  Object.keys(report).forEach((file) => {
    const executionResultForFile = report[file]
    Object.keys(executionResultForFile).forEach((executionName) => {
      const executionResultForFileOnRuntime = executionResultForFile[executionName]

      const { status, coverage } = executionResultForFileOnRuntime
      if (!coverage) {
        // several reasons not to have coverage here:
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

        if (status === "completed") {
          logger.warn(`No execution.coverage from execution named "${executionName}" of ${file}`)
        }
        return
      }

      const istanbulCoverage = normalizeIstanbulCoverage(coverage, projectDirectoryUrl)
      istanbulCoverages.push(istanbulCoverage)
    })
  })

  const istanbulCoverage = composeIstanbulCoverages(istanbulCoverages, {
    coverageV8MergeConflictIsExpected,
  })

  return istanbulCoverage
}
