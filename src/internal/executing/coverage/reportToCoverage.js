import { collectFiles } from "@jsenv/filesystem"

import { relativeUrlToEmptyCoverage } from "./relativeUrlToEmptyCoverage.js"
import { istanbulCoverageFromCoverages } from "./istanbulCoverageFromCoverages.js"
import { normalizeIstanbulCoverage } from "./normalizeIstanbulCoverage.js"

export const reportToCoverage = async (
  report,
  {
    multipleExecutionsOperation,
    logger,
    projectDirectoryUrl,
    babelPluginMap,
    coverageConfig,
    coverageIncludeMissing,
    coverageV8MergeConflictIsExpected,
  },
) => {
  // here we should forward multipleExecutionsOperation.signal
  // to allow aborting this too
  const istanbulCoverageFromExecution = await executionReportToCoverage(
    report,
    {
      logger,
      projectDirectoryUrl,
      coverageV8MergeConflictIsExpected,
    },
  )

  if (!coverageIncludeMissing) {
    return istanbulCoverageFromExecution
  }

  const relativeFileUrlToCoverArray = await listRelativeFileUrlToCover({
    multipleExecutionsOperation,
    projectDirectoryUrl,
    coverageConfig,
  })

  const relativeFileUrlMissingCoverageArray =
    relativeFileUrlToCoverArray.filter((relativeFileUrlToCover) =>
      Object.keys(istanbulCoverageFromExecution).every((key) => {
        return key !== `./${relativeFileUrlToCover}`
      }),
    )

  const istanbulCoverageFromMissedFiles = {}
  // maybe we should prefer reduce over Promise.all here
  // because it creates a LOT of things to do
  await Promise.all(
    relativeFileUrlMissingCoverageArray.map(
      async (relativeFileUrlMissingCoverage) => {
        const emptyCoverage = await relativeUrlToEmptyCoverage(
          relativeFileUrlMissingCoverage,
          {
            multipleExecutionsOperation,
            projectDirectoryUrl,
            babelPluginMap,
          },
        )
        istanbulCoverageFromMissedFiles[relativeFileUrlMissingCoverage] =
          emptyCoverage
        return emptyCoverage
      },
    ),
  )

  return {
    ...istanbulCoverageFromExecution, // already normalized
    ...normalizeIstanbulCoverage(
      istanbulCoverageFromMissedFiles,
      projectDirectoryUrl,
    ),
  }
}

const listRelativeFileUrlToCover = async ({
  multipleExecutionsOperation,
  projectDirectoryUrl,
  coverageConfig,
}) => {
  const structuredMetaMapForCoverage = {
    cover: coverageConfig,
  }

  const matchingFileResultArray = await collectFiles({
    signal: multipleExecutionsOperation.signal,
    directoryUrl: projectDirectoryUrl,
    structuredMetaMap: structuredMetaMapForCoverage,
    predicate: ({ cover }) => cover,
  })

  return matchingFileResultArray.map(({ relativeUrl }) => relativeUrl)
}

const executionReportToCoverage = async (
  report,
  { logger, projectDirectoryUrl, coverageV8MergeConflictIsExpected },
) => {
  const coverages = []

  Object.keys(report).forEach((file) => {
    const executionResultForFile = report[file]
    Object.keys(executionResultForFile).forEach((executionName) => {
      const executionResultForFileOnRuntime =
        executionResultForFile[executionName]

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
          logger.warn(
            `No execution.coverage from execution named "${executionName}" of ${file}`,
          )
        }
        return
      }

      coverages.push(coverage)
    })
  })

  const istanbulCoverage = await istanbulCoverageFromCoverages(coverages, {
    projectDirectoryUrl,
    coverageV8MergeConflictIsExpected,
  })

  return istanbulCoverage
}
