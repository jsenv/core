import { readFile } from "@jsenv/filesystem"

import {
  visitNodeV8Directory,
  filterV8Coverage,
} from "../coverage_utils/v8_coverage_from_directory.js"
import { composeTwoV8Coverages } from "../coverage_utils/v8_coverage_composition.js"
import { composeTwoFileByFileIstanbulCoverages } from "../coverage_utils/istanbul_coverage_composition.js"
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
    coverageV8ConflictWarning,
  },
) => {
  let v8Coverage
  let fileByFileIstanbulCoverage

  // collect v8 and istanbul coverage from executions
  await Object.keys(report).reduce(async (previous, file) => {
    await previous

    const executionResultForFile = report[file]
    await Object.keys(executionResultForFile).reduce(
      async (previous, executionName) => {
        await previous

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
            logger.debug(
              `No execution.coverageFileUrl from execution named "${executionName}" of ${file}`,
            )
          }
          return
        }

        const executionCoverage = await readFile(coverageFileUrl, {
          as: "json",
        })
        if (isV8Coverage(executionCoverage)) {
          v8Coverage = v8Coverage
            ? composeTwoV8Coverages(v8Coverage, executionCoverage)
            : executionCoverage
        } else {
          fileByFileIstanbulCoverage = fileByFileIstanbulCoverage
            ? composeTwoFileByFileIstanbulCoverages(
                fileByFileIstanbulCoverage,
                executionCoverage,
              )
            : executionCoverage
        }
      },
      Promise.resolve(),
    )
  }, Promise.resolve())

  if (!coverageForceIstanbul && process.env.NODE_V8_COVERAGE) {
    await visitNodeV8Directory({
      signal: multipleExecutionsOperation.signal,
      NODE_V8_COVERAGE: process.env.NODE_V8_COVERAGE,
      onV8Coverage: (nodeV8Coverage) => {
        const nodeV8CoverageLight = filterV8Coverage(nodeV8Coverage, {
          coverageIgnorePredicate,
        })
        v8Coverage = v8Coverage
          ? composeTwoV8Coverages(v8Coverage, nodeV8CoverageLight)
          : nodeV8CoverageLight
      },
    })
  }

  // try to merge v8 with istanbul, if any
  let fileByFileCoverage
  if (v8Coverage) {
    let v8FileByFileCoverage = await v8CoverageToIstanbul(v8Coverage)

    v8FileByFileCoverage = normalizeFileByFileCoveragePaths(
      v8FileByFileCoverage,
      projectDirectoryUrl,
    )

    if (fileByFileIstanbulCoverage) {
      fileByFileIstanbulCoverage = normalizeFileByFileCoveragePaths(
        fileByFileIstanbulCoverage,
        projectDirectoryUrl,
      )
      fileByFileCoverage = composeV8AndIstanbul(
        v8FileByFileCoverage,
        fileByFileIstanbulCoverage,
        { coverageV8ConflictWarning },
      )
    } else {
      fileByFileCoverage = v8FileByFileCoverage
    }
  }
  // get istanbul only
  else if (fileByFileIstanbulCoverage) {
    fileByFileCoverage = normalizeFileByFileCoveragePaths(
      fileByFileIstanbulCoverage,
      projectDirectoryUrl,
    )
  }
  // no coverage found in execution (or zero file where executed)
  else {
    fileByFileCoverage = {}
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
      fileByFileCoverage[`./${relativeUrlMissing}`] = emptyCoverage
      return emptyCoverage
    }, Promise.resolve())
  }

  return fileByFileCoverage
}

const isV8Coverage = (coverage) => Boolean(coverage.result)
