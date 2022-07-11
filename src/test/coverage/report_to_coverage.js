import { readFileSync } from "node:fs"
import { Abort } from "@jsenv/abort"

import { filterV8Coverage } from "./v8_coverage.js"
import { readNodeV8CoverageDirectory } from "./v8_coverage_node_directory.js"
import { composeTwoV8Coverages } from "./v8_coverage_composition.js"
import { composeTwoFileByFileIstanbulCoverages } from "./istanbul_coverage_composition.js"
import { v8CoverageToIstanbul } from "./v8_coverage_to_istanbul.js"
import { composeV8AndIstanbul } from "./v8_and_istanbul.js"
import { normalizeFileByFileCoveragePaths } from "./file_by_file_coverage.js"
import { getMissingFileByFileCoverage } from "./missing_coverage.js"

export const reportToCoverage = async (
  report,
  {
    signal,
    logger,
    rootDirectoryUrl,
    coverageConfig,
    coverageIncludeMissing,
    coverageMethodForNodeJs,
    coverageV8ConflictWarning,
  },
) => {
  // collect v8 and istanbul coverage from executions
  let { v8Coverage, fileByFileIstanbulCoverage } = await getCoverageFromReport({
    signal,
    report,
    onMissing: ({ file, executionResult, executionName }) => {
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
      if (
        executionResult.status === "completed" &&
        executionResult.type === "node" &&
        coverageMethodForNodeJs !== "NODE_V8_COVERAGE"
      ) {
        logger.warn(
          `No "coverageFileUrl" from execution named "${executionName}" of ${file}`,
        )
      }
    },
  })

  if (coverageMethodForNodeJs === "NODE_V8_COVERAGE") {
    await readNodeV8CoverageDirectory({
      logger,
      signal,
      onV8Coverage: async (nodeV8Coverage) => {
        const nodeV8CoverageLight = await filterV8Coverage(nodeV8Coverage, {
          rootDirectoryUrl,
          coverageConfig,
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
    let v8FileByFileCoverage = await v8CoverageToIstanbul(v8Coverage, {
      signal,
    })

    v8FileByFileCoverage = normalizeFileByFileCoveragePaths(
      v8FileByFileCoverage,
      rootDirectoryUrl,
    )

    if (fileByFileIstanbulCoverage) {
      fileByFileIstanbulCoverage = normalizeFileByFileCoveragePaths(
        fileByFileIstanbulCoverage,
        rootDirectoryUrl,
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
      rootDirectoryUrl,
    )
  }
  // no coverage found in execution (or zero file where executed)
  else {
    fileByFileCoverage = {}
  }

  // now add coverage for file not covered
  if (coverageIncludeMissing) {
    const missingFileByFileCoverage = await getMissingFileByFileCoverage({
      signal,
      rootDirectoryUrl,
      coverageConfig,
      fileByFileCoverage,
    })
    Object.assign(
      fileByFileCoverage,
      normalizeFileByFileCoveragePaths(
        missingFileByFileCoverage,
        rootDirectoryUrl,
      ),
    )
  }

  return fileByFileCoverage
}

const getCoverageFromReport = async ({ signal, report, onMissing }) => {
  const operation = Abort.startOperation()
  operation.addAbortSignal(signal)

  try {
    let v8Coverage
    let fileByFileIstanbulCoverage

    // collect v8 and istanbul coverage from executions
    await Object.keys(report).reduce(async (previous, file) => {
      operation.throwIfAborted()
      await previous

      const executionResultForFile = report[file]
      await Object.keys(executionResultForFile).reduce(
        async (previous, executionName) => {
          operation.throwIfAborted()
          await previous

          const executionResultForFileOnRuntime =
            executionResultForFile[executionName]
          const { coverageFileUrl } = executionResultForFileOnRuntime
          if (!coverageFileUrl) {
            onMissing({
              executionName,
              file,
              executionResult: executionResultForFileOnRuntime,
            })
            return
          }

          const executionCoverage = JSON.parse(
            String(readFileSync(coverageFileUrl)),
          )
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

    return {
      v8Coverage,
      fileByFileIstanbulCoverage,
    }
  } finally {
    await operation.end()
  }
}

const isV8Coverage = (coverage) => Boolean(coverage.result)
