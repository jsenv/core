/* eslint-disable import/max-dependencies */
import { cpus } from "os"
import { stat } from "fs"
import {
  createConcurrentOperations,
  createCancellationSource,
  composeCancellationToken,
} from "@jsenv/cancellation"
import { loggerToLevels } from "@jsenv/logger"
import { urlToFileSystemPath } from "@jsenv/util"
import { require } from "../require.js"
import { launchAndExecute } from "../executing/launchAndExecute.js"
import { reportToCoverageMap } from "./coverage/reportToCoverageMap.js"
import { writeLog } from "./writeLog.js"
import { createExecutionResultLog } from "./executionLogs.js"
import { createSummaryLog } from "./createSummaryLog.js"

const wrapAnsi = require("wrap-ansi")

export const executeConcurrently = async (
  executionSteps,
  {
    cancellationToken,
    logger,
    executionLogLevel,

    projectDirectoryUrl,
    outDirectoryRelativeUrl,
    compileServerOrigin,

    babelPluginMap,

    concurrencyLimit = Math.max(cpus.length - 1, 1),
    executionDefaultOptions = {},
    stopAfterExecute,
    logSummary,
    completedExecutionLogMerging,
    completedExecutionLogAbbreviation,

    coverage,
    coverageConfig,
    coverageIncludeMissing,

    ...rest
  },
) => {
  if (typeof compileServerOrigin !== "string") {
    throw new TypeError(`compileServerOrigin must be a string, got ${compileServerOrigin}`)
  }

  const executionOptionsFromDefault = {
    allocatedMs: 30000,
    measureDuration: true,
    // mirrorConsole: false because file will be executed in parallel
    // so log would be a mess to read
    mirrorConsole: false,
    captureConsole: true,
    collectRuntimeName: true,
    collectRuntimeVersion: true,
    collectNamespace: false,
    collectCoverage: coverage,

    mainFileNotFoundCallback: ({ fileRelativeUrl }) => {
      logger.error(
        new Error(`an execution main file does not exists.
--- file relative path ---
${fileRelativeUrl}`),
      )
    },
    beforeExecutionCallback: () => {},
    afterExecutionCallback: () => {},
    ...executionDefaultOptions,
  }

  const startMs = Date.now()

  const allExecutionDoneCancellationSource = createCancellationSource()
  const executionCancellationToken = composeCancellationToken(
    cancellationToken,
    allExecutionDoneCancellationSource.token,
  )

  const report = {}
  const executionCount = executionSteps.length

  let previousExecutionResult
  let previousExecutionLog
  let disconnectedCount = 0
  let timedoutCount = 0
  let erroredCount = 0
  let completedCount = 0
  await createConcurrentOperations({
    cancellationToken,
    concurrencyLimit,
    array: executionSteps,
    start: async (executionOptionsFromStep) => {
      const executionIndex = executionSteps.indexOf(executionOptionsFromStep)
      const executionOptions = {
        ...executionOptionsFromDefault,
        ...executionOptionsFromStep,
      }

      const {
        name,
        executionId,
        fileRelativeUrl,
        launch,
        allocatedMs,
        measureDuration,
        mirrorConsole,
        captureConsole,
        collectRuntimeName,
        collectRuntimeVersion,
        collectCoverage,
        collectNamespace,

        mainFileNotFoundCallback,
        beforeExecutionCallback,
        afterExecutionCallback,
        gracefulStopAllocatedMs,
      } = executionOptions

      const beforeExecutionInfo = {
        allocatedMs,
        name,
        executionId,
        fileRelativeUrl,
        executionIndex,
      }

      const filePath = urlToFileSystemPath(`${projectDirectoryUrl}${fileRelativeUrl}`)
      const fileExists = await pathLeadsToFile(filePath)
      if (!fileExists) {
        mainFileNotFoundCallback(beforeExecutionInfo)
        return
      }

      beforeExecutionCallback(beforeExecutionInfo)
      const executionResult = await launchAndExecute({
        cancellationToken: executionCancellationToken,
        executionLogLevel,
        launch: (params) =>
          launch({
            projectDirectoryUrl,
            outDirectoryRelativeUrl,
            compileServerOrigin,
            ...params,
          }),
        allocatedMs,
        measureDuration,
        collectRuntimeName,
        collectRuntimeVersion,
        mirrorConsole,
        captureConsole,
        gracefulStopAllocatedMs,
        stopAfterExecute,
        stopAfterExecuteReason: "execution-done",
        executionId,
        fileRelativeUrl,
        collectCoverage,
        collectNamespace,

        ...rest,
      })
      const afterExecutionInfo = {
        ...beforeExecutionInfo,
        ...executionResult,
      }
      afterExecutionCallback(afterExecutionInfo)

      if (executionResult.status === "timedout") {
        timedoutCount++
      } else if (executionResult.status === "disconnected") {
        disconnectedCount++
      } else if (executionResult.status === "errored") {
        erroredCount++
      } else if (executionResult.status === "completed") {
        completedCount++
      }

      if (loggerToLevels(logger).info) {
        let log = createExecutionResultLog(afterExecutionInfo, {
          completedExecutionLogAbbreviation,
          executionCount,
          disconnectedCount,
          timedoutCount,
          erroredCount,
          completedCount,
        })
        const { columns = 80 } = process.stdout
        log = wrapAnsi(log, columns, {
          trim: false,
          hard: true,
          wordWrap: false,
        })

        if (
          previousExecutionLog &&
          completedExecutionLogMerging &&
          previousExecutionResult &&
          previousExecutionResult.status === "completed" &&
          (previousExecutionResult.consoleCalls
            ? previousExecutionResult.consoleCalls.length === 0
            : true) &&
          executionResult.status === "completed"
        ) {
          previousExecutionLog = previousExecutionLog.update(log)
        } else {
          previousExecutionLog = writeLog(log)
        }
      }

      if (fileRelativeUrl in report === false) {
        report[fileRelativeUrl] = {}
      }
      report[fileRelativeUrl][name] = executionResult
      previousExecutionResult = executionResult
    },
  })

  // tell everyone we are done
  // (used to stop potential chrome browser still opened to be reused)
  allExecutionDoneCancellationSource.cancel("all execution done")

  const summary = reportToSummary(report)
  summary.startMs = startMs
  summary.endMs = Date.now()

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
            projectDirectoryUrl,
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
          const fileExecutionResultForRuntime = fileExecutionResult[executionName]
          return predicate(fileExecutionResultForRuntime)
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
