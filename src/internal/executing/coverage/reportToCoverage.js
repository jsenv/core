import { readFile } from "@jsenv/filesystem"

import { v8CoverageFromNodeV8Directory } from "../coverage_utils/v8_coverage_from_directory.js"
import { composeTwoV8Coverages } from "../coverage_utils/v8_coverage_composition.js"
import { composeTwoIstanbulCoverages } from "../coverage_utils/istanbul_coverage_composition.js"
import { v8CoverageToIstanbul } from "../coverage_utils/v8_coverage_to_istanbul.js"
import { composeV8AndIstanbul } from "../coverage_utils/v8_and_istanbul.js"
import { normalizeFileByFileCoveragePaths } from "../coverage_utils/file_by_file_coverage.js"
import { listRelativeFileUrlToCover } from "../coverage_empty/list_files_not_covered.js"
import { relativeUrlToEmptyCoverage } from "../coverage_empty/relativeUrlToEmptyCoverage.js"

export const reportToCoverage = async (
  report,
  {
    multipleExecutionsOperation,
    logger,
    projectDirectoryUrl,
    babelPluginMap,
    coverageConfig,
    coverageIncludeMissing,
    coverageIgnorePredicate,
    coverageForceIstanbul,
    coverageV8MergeConflictIsExpected,
  },
) => {
  let currentV8Coverage
  let currentIstanbulCoverage

  if (!coverageForceIstanbul && process.env.NODE_V8_COVERAGE) {
    currentV8Coverage = await v8CoverageFromNodeV8Directory({
      NODE_V8_COVERAGE: process.env.NODE_V8_COVERAGE,
      coverageIgnorePredicate,
    })
  }

  await Object.keys(report).reduce(async (previous, file) => {
    const executionResultForFile = report[file]
    await Object.keys(executionResultForFile).reduce(
      async (previous, executionName) => {
        const executionResultForFileOnRuntime =
          executionResultForFile[executionName]
        const { status, coverageFileUrl } = executionResultForFileOnRuntime
        if (!coverageFileUrl) {
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

        const executionCoverage = await readFile(coverageFileUrl, {
          as: "json",
        })

        if (isV8Coverage(executionCoverage)) {
          currentV8Coverage = currentV8Coverage
            ? composeTwoV8Coverages(currentV8Coverage, executionCoverage)
            : executionCoverage
        } else {
          currentIstanbulCoverage = currentIstanbulCoverage
            ? composeTwoIstanbulCoverages(
                currentIstanbulCoverage,
                executionCoverage,
              )
            : executionCoverage
        }
      },
      Promise.resolve(),
    )
  }, Promise.resolve())

  // now let's try to merge v8 with istanbul, if any
  let fileByFileCoverage
  if (currentV8Coverage) {
    let v8FileByFileCoverage = await v8CoverageToIstanbul(currentV8Coverage)

    v8FileByFileCoverage = normalizeFileByFileCoveragePaths(
      v8FileByFileCoverage,
      projectDirectoryUrl,
    )

    if (currentIstanbulCoverage) {
      currentIstanbulCoverage = normalizeFileByFileCoveragePaths(
        currentIstanbulCoverage,
        projectDirectoryUrl,
      )
      fileByFileCoverage = composeV8AndIstanbul(
        v8FileByFileCoverage,
        currentIstanbulCoverage,
        { coverageV8MergeConflictIsExpected },
      )
    } else {
      fileByFileCoverage = v8FileByFileCoverage
    }
  } else {
    fileByFileCoverage =
      normalizeFileByFileCoveragePaths(
        currentIstanbulCoverage,
        projectDirectoryUrl,
      ) || {}
  }

  // now add coverage for file not covered
  if (coverageIncludeMissing) {
    const relativeUrlsToCover = await listRelativeFileUrlToCover({
      multipleExecutionsOperation,
      projectDirectoryUrl,
      coverageConfig,
    })

    const relativeUrlsMissing = relativeUrlsToCover.filter(
      (relativeUrlToCover) =>
        Object.keys(fileByFileCoverage).every((key) => {
          return key !== `./${relativeUrlToCover}`
        }),
    )

    await relativeUrlsMissing.reduce(async (previous, relativeUrlMissing) => {
      const emptyCoverage = await relativeUrlToEmptyCoverage(
        relativeUrlMissing,
        {
          multipleExecutionsOperation,
          projectDirectoryUrl,
          babelPluginMap,
        },
      )
      fileByFileCoverage[relativeUrlMissing] = emptyCoverage
      return emptyCoverage
    }, Promise.resolve())
  }

  return fileByFileCoverage
}

const isV8Coverage = (coverage) => Boolean(coverage.result)
