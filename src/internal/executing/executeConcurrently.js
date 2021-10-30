import { stat } from "node:fs"
import wrapAnsi from "wrap-ansi"
import { loggerToLevels, createDetailedMessage } from "@jsenv/logger"
import { urlToFileSystemPath } from "@jsenv/filesystem"

// import { Abort } from "@jsenv/core/src/abort/main.js"
import { launchAndExecute } from "../executing/launchAndExecute.js"
import { reportToCoverage } from "./coverage/reportToCoverage.js"
import { writeLog } from "./writeLog.js"
import { createExecutionResultLog } from "./executionLogs.js"
import { createSummaryLog } from "./createSummaryLog.js"

export const executeConcurrently = async (
  executionSteps,
  {
    executionOperation,

    logger,
    launchAndExecuteLogLevel,

    projectDirectoryUrl,
    compileServerOrigin,
    outDirectoryRelativeUrl,

    babelPluginMap,

    defaultMsAllocatedPerExecution = 30000,
    maxExecutionsInParallel = 1,
    completedExecutionLogMerging,
    completedExecutionLogAbbreviation,
    measureGlobalDuration = true,

    coverage,
    coverageConfig,
    coverageIncludeMissing,
    coverageForceIstanbul,
    coverageV8MergeConflictIsExpected,

    mainFileNotFoundCallback = ({ fileRelativeUrl }) => {
      logger.error(
        new Error(
          createDetailedMessage(`an execution main file does not exists.`, {
            ["file relative path"]: fileRelativeUrl,
          }),
        ),
      )
    },
    beforeExecutionCallback = () => {},
    afterExecutionCallback = () => {},

    logSummary,
  },
) => {
  const startMs = Date.now()

  const report = {}
  const executionCount = executionSteps.length

  let previousExecutionResult
  let previousExecutionLog
  let disconnectedCount = 0
  let timedoutCount = 0
  let erroredCount = 0
  let completedCount = 0
  await executeInParallel({
    abortSignal: executionOperation.abortSignal,
    maxExecutionsInParallel,
    executionSteps,
    start: async (paramsFromStep) => {
      const executionIndex = executionSteps.indexOf(paramsFromStep)
      const { executionName, fileRelativeUrl } = paramsFromStep
      const executionParams = {
        // the params below can be overriden by executionDefaultParams
        measurePerformance: false,
        collectPerformance: false,
        measureDuration: true,
        captureConsole: true,
        collectRuntimeName: true,
        collectRuntimeVersion: true,
        // stopAfterExecute: true to ensure runtime is stopped once executed
        // because we have what we wants: execution is completed and
        // we have associated coverage and capturedConsole
        // passsing false means all node process and browsers launched stays opened
        // (can eventually be used for debug)
        stopAfterExecute: true,
        stopAfterExecuteReason: "execution-done",
        allocatedMs: defaultMsAllocatedPerExecution,
        ...paramsFromStep,
        // mirrorConsole: false because file will be executed in parallel
        // so log would be a mess to read
        mirrorConsole: false,
      }

      const beforeExecutionInfo = {
        fileRelativeUrl,
        executionIndex,
        executionParams,
      }

      const filePath = urlToFileSystemPath(
        `${projectDirectoryUrl}${fileRelativeUrl}`,
      )
      const fileExists = await pathLeadsToFile(filePath)
      if (!fileExists) {
        mainFileNotFoundCallback(beforeExecutionInfo)
        return
      }

      beforeExecutionCallback(beforeExecutionInfo)

      const executionResult = await launchAndExecute({
        abortSignal: executionOperation.abortSignal,
        launchAndExecuteLogLevel,

        ...executionParams,
        collectCoverage: coverage,
        runtimeParams: {
          projectDirectoryUrl,
          compileServerOrigin,
          outDirectoryRelativeUrl,
          collectCoverage: coverage,
          coverageConfig,
          coverageForceIstanbul,
          ...executionParams.runtimeParams,
        },
        executeParams: {
          fileRelativeUrl,
          ...executionParams.executeParams,
        },

        coverageV8MergeConflictIsExpected,
      })
      const afterExecutionInfo = {
        ...beforeExecutionInfo,
        executionResult,
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
          previousExecutionLog = writeLog(log, {
            mightUpdate: completedExecutionLogMerging,
          })
        }
      }

      if (fileRelativeUrl in report === false) {
        report[fileRelativeUrl] = {}
      }
      report[fileRelativeUrl][executionName] = executionResult
      previousExecutionResult = executionResult
    },
  })

  if (executionOperation.abortSignal.aborted) {
    // take this into account
    // like return a report marking all remaining operationss
    // as "aborted"
    // in the logs we'll handle that to avoid showing 100 canceled operation
    // and regroup them instead
  }

  // tell everyone we are done
  // (used to stop potential chrome browser still opened to be reused)
  executionOperation.cleaner.clean("all execution done")

  const summary = reportToSummary(report)
  if (measureGlobalDuration) {
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
          coverage: await reportToCoverage(report, {
            // not sure we want to pass an abort signal here?
            // or we likely should just not call this at all when aborted?
            // abortSignal: executionOperation.abortSignal,
            logger,
            projectDirectoryUrl,
            babelPluginMap,
            coverageConfig,
            coverageIncludeMissing,
            coverageV8MergeConflictIsExpected,
          }),
        }
      : {}),
  }
}

const executeInParallel = async ({
  abortSignal,
  executionSteps,
  start,
  maxExecutionsInParallel = 1,
}) => {
  const executionResults = []
  let progressionIndex = 0
  let remainingExecutionCount = executionSteps.length

  const nextChunk = async () => {
    if (abortSignal.aborted) {
      return
    }

    const outputPromiseArray = []
    while (
      remainingExecutionCount > 0 &&
      outputPromiseArray.length < maxExecutionsInParallel
    ) {
      remainingExecutionCount--
      const outputPromise = executeOne(progressionIndex)
      progressionIndex++
      outputPromiseArray.push(outputPromise)
    }

    if (outputPromiseArray.length) {
      await Promise.all(outputPromiseArray)
      if (remainingExecutionCount > 0) {
        await nextChunk()
      }
    }
  }

  const executeOne = async (index) => {
    const input = executionSteps[index]
    const output = await start(input)
    executionResults[index] = output
  }

  await nextChunk()

  return executionResults
}

const pathLeadsToFile = (path) => {
  return new Promise((resolve, reject) => {
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
}

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
          const fileExecutionResultForRuntime =
            fileExecutionResult[executionName]
          return predicate(fileExecutionResultForRuntime)
        }).length
      )
    }, 0)
  }

  const disconnectedCount = countResultMatching(
    ({ status }) => status === "disconnected",
  )
  const timedoutCount = countResultMatching(
    ({ status }) => status === "timedout",
  )
  const erroredCount = countResultMatching(({ status }) => status === "errored")
  const completedCount = countResultMatching(
    ({ status }) => status === "completed",
  )

  return {
    executionCount,
    disconnectedCount,
    timedoutCount,
    erroredCount,
    completedCount,
  }
}
