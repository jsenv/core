/* eslint-disable import/max-dependencies */
import { cpus } from "os"
import { stat } from "fs"
import { createConcurrentOperations } from "@dmail/cancellation"
import { metaMapToSpecifierMetaMap } from "@jsenv/url-meta"
import { collectFiles } from "@jsenv/file-collector"
import { fileUrlToPath } from "../urlUtils.js"
import { launchAndExecute } from "../../launchAndExecute.js"
import {
  createCompletedLog,
  createDisconnectedLog,
  createErroredLog,
  createTimedoutLog,
} from "./executionLogs.js"
import { createSummaryLog } from "./createSummaryLog.js"
import { relativePathToEmptyCoverage } from "../coverage/relativePathToEmptyCoverage.js"
import { executionReportToCoverageMap } from "../coverage/executionReportToCoverageMap.js"

export const executeConcurrently = async (
  executionSteps,
  {
    cancellationToken,
    logger,
    launchLogger,
    executeLogger,

    compileServerOrigin,
    projectDirectoryUrl,
    compileDirectoryUrl,
    importMapFileRelativePath,
    importDefaultExtension,
    babelPluginMap,

    measureDuration = false,
    concurrencyLimit = Math.max(cpus.length - 1, 1),
    logSummary = true,

    // coverage parameters
    coverage = false,
    coverageConfig,
    coverageIncludeMissing = true,

    stepParams = {},
  },
) => {
  if (typeof compileServerOrigin !== "string") {
    throw new TypeError(`compileServerOrigin must be a string, got ${compileServerOrigin}`)
  }

  stepParams = {
    allocatedMs: 30000,
    measureDuration: true,
    // mirrorConsole: false because file will be executed in parallel
    // so log would be a mess to read
    mirrorConsole: false,
    captureConsole: true,
    collectNamespace: false,
    collectCoverage: coverage,

    logSuccess: true,
    mainFileNotFoundCallback: ({ fileRelativePath }) => {
      logger.error(
        new Error(`an execution main file does not exists.
--- file relative path ---
${fileRelativePath}`),
      )
    },
    beforeExecutionCallback: () => {},
    afterExecutionCallback: () => {},
    ...stepParams,
  }

  let startMs
  if (measureDuration) {
    startMs = Date.now()
  }

  const report = {}
  await createConcurrentOperations({
    cancellationToken,
    maxParallelExecution: concurrencyLimit,
    array: executionSteps,
    start: async (executionStep) => {
      const {
        name,
        executionId,
        fileRelativePath,
        launch,
        allocatedMs,
        measureDuration,
        mirrorConsole,
        captureConsole,
        collectPlatformName,
        collectPlatformVersion,
        collectCoverage,
        collectNamespace,

        mainFileNotFoundCallback,
        beforeExecutionCallback,
        afterExecutionCallback,
        logSuccess,
      } = {
        ...stepParams,
        ...executionStep,
      }

      const beforeExecutionInfo = {
        allocatedMs,
        name,
        executionId,
        fileRelativePath,
      }

      const filePath = fileUrlToPath(`${projectDirectoryUrl}${fileRelativePath}`)
      const fileExists = await pathLeadsToFile(filePath)
      if (!fileExists) {
        mainFileNotFoundCallback(beforeExecutionInfo)
        return
      }

      beforeExecutionCallback(beforeExecutionInfo)
      const executionResult = await launchAndExecute({
        cancellationToken,
        launchLogger,
        executeLogger,
        launch: (options) =>
          launch({
            compileServerOrigin,
            projectDirectoryUrl,
            compileDirectoryUrl,
            importMapFileRelativePath,
            importDefaultExtension,
            babelPluginMap,
            cover: collectCoverage,
            ...options,
          }),
        allocatedMs,
        measureDuration,
        collectPlatformName,
        collectPlatformVersion,
        mirrorConsole,
        captureConsole,
        // stopPlatformAfterExecute: true to ensure platform is stopped once executed
        // because we have what we wants: execution is completed and
        // we have associated coverageMap and capturedConsole
        stopPlatformAfterExecute: true,
        executionId,
        fileRelativePath,
        collectCoverage,
        collectNamespace,
      })
      const afterExecutionInfo = {
        ...beforeExecutionInfo,
        ...executionResult,
      }
      afterExecutionCallback(afterExecutionInfo)

      const { status } = executionResult

      if (status === "completed" && logSuccess) {
        logger.info(createCompletedLog(afterExecutionInfo))
      } else if (status === "disconnected") {
        logger.info(createDisconnectedLog(afterExecutionInfo))
      } else if (status === "timedout") {
        logger.info(createTimedoutLog(afterExecutionInfo))
      } else if (status === "errored") {
        logger.info(createErroredLog(afterExecutionInfo))
      }

      if (fileRelativePath in report === false) {
        report[fileRelativePath] = {}
      }
      report[fileRelativePath][name] = executionResult
    },
  })

  const summary = reportToSummary(report)
  if (measureDuration) {
    summary.startMs = startMs
    summary.endMs = Date.now()
  }

  if (logSummary) {
    logger.info(createSummaryLog(summary))
  }

  return {
    summary,
    report,
    ...(coverage
      ? {
          coverageMap: await reportToCoverageMap(report, {
            cancellationToken,
            babelPluginMap,
            coverageConfig,
            coverageIncludeMissing,
          }),
        }
      : {}),
  }
}

const pathLeadsToFile = (path) =>
  new Promise((resolve, reject) => {
    stat(path, (error, stats) => {
      if (error) {
        if (error.code === "ENOENT") {
          resolve(false)
        } else {
          reject(error)
        }
      } else {
        resolve(stats.isFile())
      }
    })
  })

const reportToSummary = (report) => {
  const fileNames = Object.keys(report)
  const executionCount = fileNames.reduce((previous, fileName) => {
    return previous + Object.keys(report[fileName]).length
  }, 0)

  const countResultMatching = (predicate) => {
    return fileNames.reduce((previous, fileName) => {
      const fileExecutionResult = report[fileName]

      return (
        previous +
        Object.keys(fileExecutionResult).filter((executionName) => {
          const fileExecutionResultForPlatform = fileExecutionResult[executionName]
          return predicate(fileExecutionResultForPlatform)
        }).length
      )
    }, 0)
  }

  const disconnectedCount = countResultMatching(({ status }) => status === "disconnected")
  const timedoutCount = countResultMatching(({ status }) => status === "timedout")
  const erroredCount = countResultMatching(({ status }) => status === "errored")
  const completedCount = countResultMatching(({ status }) => status === "completed")

  return {
    executionCount,
    disconnectedCount,
    timedoutCount,
    erroredCount,
    completedCount,
  }
}

const reportToCoverageMap = async (
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

  const relativePathToCoverArray = await listRelativePathToCover({
    cancellationToken,
    projectDirectoryUrl,
    coverageConfig,
  })

  const relativePathMissingCoverageArray = relativePathToCoverArray.filter(
    (relativePathToCover) => relativePathToCover in coverageMapForReport === false,
  )

  const coverageMapForMissedFiles = {}
  await Promise.all(
    relativePathMissingCoverageArray.map(async (relativePathMissingCoverage) => {
      const emptyCoverage = await relativePathToEmptyCoverage({
        cancellationToken,
        projectDirectoryUrl,
        relativePath: relativePathMissingCoverage,
        babelPluginMap,
      })
      coverageMapForMissedFiles[relativePathMissingCoverage] = emptyCoverage
      return emptyCoverage
    }),
  )

  return {
    ...coverageMapForReport,
    ...coverageMapForMissedFiles,
  }
}

const listRelativePathToCover = async ({
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

  return matchingFileResultArray.map(({ relativePath }) => relativePath)
}
