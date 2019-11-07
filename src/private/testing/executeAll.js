import { cpus } from "os"
import { stat } from "fs"
import {
  operatingSystemPathToPathname,
  pathnameToOperatingSystemPath,
} from "@jsenv/operating-system-path"
import { createConcurrentOperations } from "@dmail/cancellation"
import { createLogger } from "@jsenv/logger"
import {
  createCompletedLog,
  createDisconnectedLog,
  createErroredLog,
  createTimedoutLog,
} from "./executionLogs.js"
import { createSummaryLog } from "./createSummaryLog.js"

// use import.meta.require to avoid breaking relativePathInception
const { launchAndExecute } = import.meta.require("@jsenv/execution")

export const executeAll = async (
  executionArray,
  {
    cancellationToken,
    compileServerOrigin,
    projectPath,
    compileIntoRelativePath,
    importMapRelativePath,
    importDefaultExtension,
    babelPluginMap,
    logLevel,
    launchLogLevel = "off",
    executeLogLevel = "off",
    logEachExecutionSuccess = true,
    logSummary = true,
    maxParallelExecution = Math.max(cpus.length - 1, 1),
    defaultAllocatedMsPerExecution,
    beforeEachExecutionCallback = () => {},
    afterEachExecutionCallback = () => {},
    captureConsole = false,
    measureDuration = false,
    measureTotalDuration = false,
    collectNamespace = false,
    collectCoverage = false,
    mainFileNotFoundCallback,
  } = {},
) => {
  if (typeof compileServerOrigin !== "string") {
    throw new TypeError(`compileServerOrigin must be a string, got ${compileServerOrigin}`)
  }
  if (typeof projectPath !== "string") {
    throw new TypeError(`projectPath must be a string, got ${projectPath}`)
  }
  if (typeof compileIntoRelativePath !== "string") {
    throw new TypeError(`compileIntoRelativePath must be a string, got ${compileIntoRelativePath}`)
  }

  const logger = createLogger({ logLevel })

  if (typeof mainFileNotFoundCallback === "undefined") {
    mainFileNotFoundCallback = ({ relativePath }) => {
      logger.error(
        new Error(`an execution main file does not exists.
relative path: ${relativePath}`),
      )
    }
  }

  // console.log(createExecutionPlanStartLog({ executionPlan }))

  let startMs
  if (measureTotalDuration) {
    startMs = Date.now()
  }

  const projectPathname = operatingSystemPathToPathname(projectPath)

  const report = {}
  await createConcurrentOperations({
    cancellationToken,
    maxParallelExecution,
    array: executionArray,
    start: async ({
      executionName,
      executionId,
      launch,
      allocatedMs = defaultAllocatedMsPerExecution,
      fileRelativePath,
    }) => {
      const fileExists = await pathLeadsToFile(
        pathnameToOperatingSystemPath(`${projectPathname}${fileRelativePath}`),
      )
      if (!fileExists) {
        mainFileNotFoundCallback({ relativePath: fileRelativePath, executionName, executionId })
        return
      }

      const beforeExecutionInfo = {
        allocatedMs,
        executionName,
        executionId,
        fileRelativePath,
      }

      beforeEachExecutionCallback(beforeExecutionInfo)

      const executionResult = await launchAndExecute({
        launch: (options) =>
          launch({
            compileServerOrigin,
            projectPath,
            compileIntoRelativePath,
            importMapRelativePath,
            importDefaultExtension,
            babelPluginMap,
            cover: collectCoverage,
            ...options,
          }),
        cancellationToken,
        allocatedMs,
        measureDuration,
        launchLogLevel,
        executeLogLevel,
        collectPlatformNameAndVersion: true,
        // mirrorConsole: false because file will be executed in parallel
        // so log would be a mess to read
        mirrorConsole: false,
        captureConsole,
        // stopOnceExecuted: true to ensure platform is stopped once executed
        // because we have what we wants: execution is completed and
        // we have associated coverageMap and capturedConsole
        stopOnceExecuted: true,
        // no need to log when disconnected
        disconnectAfterExecutedCallback: () => {},
        executionId,
        fileRelativePath,
        collectCoverage,
        collectNamespace,
      })
      const afterExecutionInfo = {
        ...beforeExecutionInfo,
        ...executionResult,
      }
      afterEachExecutionCallback(afterExecutionInfo)

      const { status } = executionResult

      if (status === "completed" && logEachExecutionSuccess) {
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
      report[fileRelativePath][executionName] = executionResult
    },
  })

  const summary = reportToSummary(report)
  if (measureTotalDuration) {
    summary.startMs = startMs
    summary.endMs = Date.now()
  }

  if (logSummary) {
    logger.info(createSummaryLog(summary))
  }

  return {
    summary,
    report,
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
