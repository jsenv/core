import { existsSync } from "node:fs"
import { memoryUsage } from "node:process"
import { takeCoverage } from "node:v8"
import wrapAnsi from "wrap-ansi"
import stripAnsi from "strip-ansi"

import { urlToFileSystemPath } from "@jsenv/urls"
import { createDetailedMessage, createLog, startSpinner } from "@jsenv/log"
import { Abort, raceProcessTeardownEvents } from "@jsenv/abort"
import { ensureEmptyDirectory, writeFileSync } from "@jsenv/filesystem"

import { reportToCoverage } from "./coverage/report_to_coverage.js"
import { run } from "@jsenv/core/src/execute/run.js"

import { pingServer } from "../ping_server.js"
import { ensureGlobalGc } from "./gc.js"
import { generateExecutionSteps } from "./execution_steps.js"
import { createExecutionLog, createSummaryLog } from "./logs_file_execution.js"

export const executePlan = async (
  plan,
  {
    signal,
    handleSIGINT,
    logger,
    logRefresh,
    logRuntime,
    logEachDuration,
    logSummary,
    logTimeUsage,
    logMemoryHeapUsage,
    logFileRelativeUrl,
    completedExecutionLogMerging,
    completedExecutionLogAbbreviation,
    rootDirectoryUrl,
    devServerOrigin,

    keepRunning,
    defaultMsAllocatedPerExecution,
    maxExecutionsInParallel,
    failFast,
    gcBetweenExecutions,
    cooldownBetweenExecutions,

    coverageEnabled,
    coverageConfig,
    coverageIncludeMissing,
    coverageMethodForBrowsers,
    coverageMethodForNodeJs,
    coverageV8ConflictWarning,
    coverageTempDirectoryRelativeUrl,

    beforeExecutionCallback = () => {},
    afterExecutionCallback = () => {},
  } = {},
) => {
  const executePlanReturnValue = {}
  const report = {}
  const callbacks = []
  const stopAfterAllSignal = { notify: () => {} }

  let someNeedsServer = false
  let someNodeRuntime = false
  const runtimes = {}
  Object.keys(plan).forEach((filePattern) => {
    const filePlan = plan[filePattern]
    Object.keys(filePlan).forEach((executionName) => {
      const executionConfig = filePlan[executionName]
      const { runtime } = executionConfig
      if (runtime) {
        runtimes[runtime.name] = runtime.version
        if (runtime.type === "browser") {
          someNeedsServer = true
        }
        if (runtime.type === "node") {
          someNodeRuntime = true
        }
      }
    })
  })
  logger.debug(
    createDetailedMessage(`Prepare executing plan`, {
      runtimes: JSON.stringify(runtimes, null, "  "),
    }),
  )
  const multipleExecutionsOperation = Abort.startOperation()
  multipleExecutionsOperation.addAbortSignal(signal)
  if (handleSIGINT) {
    multipleExecutionsOperation.addAbortSource((abort) => {
      return raceProcessTeardownEvents(
        {
          SIGINT: true,
        },
        () => {
          logger.debug(`SIGINT abort`)
          abort()
        },
      )
    })
  }
  const failFastAbortController = new AbortController()
  if (failFast) {
    multipleExecutionsOperation.addAbortSignal(failFastAbortController.signal)
  }

  try {
    const coverageTempDirectoryUrl = new URL(
      coverageTempDirectoryRelativeUrl,
      rootDirectoryUrl,
    ).href
    if (
      someNodeRuntime &&
      coverageEnabled &&
      coverageMethodForNodeJs === "NODE_V8_COVERAGE"
    ) {
      if (process.env.NODE_V8_COVERAGE) {
        // when runned multiple times, we don't want to keep previous files in this directory
        await ensureEmptyDirectory(process.env.NODE_V8_COVERAGE)
      } else {
        coverageMethodForNodeJs = "Profiler"
        logger.warn(
          createDetailedMessage(
            `process.env.NODE_V8_COVERAGE is required to generate coverage for Node.js subprocesses`,
            {
              "suggestion": `set process.env.NODE_V8_COVERAGE`,
              "suggestion 2": `use coverageMethodForNodeJs: "Profiler". But it means coverage for child_process and worker_thread cannot be collected`,
            },
          ),
        )
      }
    }

    if (gcBetweenExecutions) {
      ensureGlobalGc()
    }

    if (coverageEnabled) {
      // when runned multiple times, we don't want to keep previous files in this directory
      await ensureEmptyDirectory(coverageTempDirectoryUrl)
      callbacks.push(async () => {
        if (multipleExecutionsOperation.signal.aborted) {
          // don't try to do the coverage stuff
          return
        }
        try {
          if (coverageMethodForNodeJs === "NODE_V8_COVERAGE") {
            takeCoverage()
            // conceptually we don't need coverage anymore so it would be
            // good to call v8.stopCoverage()
            // but it logs a strange message about "result is not an object"
          }
          const planCoverage = await reportToCoverage(report, {
            signal: multipleExecutionsOperation.signal,
            logger,
            rootDirectoryUrl,
            coverageConfig,
            coverageIncludeMissing,
            coverageMethodForBrowsers,
            coverageV8ConflictWarning,
          })
          executePlanReturnValue.planCoverage = planCoverage
        } catch (e) {
          if (Abort.isAbortError(e)) {
            return
          }
          throw e
        }
      })
    }

    let runtimeParams = {
      rootDirectoryUrl,
      devServerOrigin,
      coverageEnabled,
      coverageConfig,
      coverageMethodForBrowsers,
      coverageMethodForNodeJs,
      stopAfterAllSignal,
    }
    if (someNeedsServer) {
      if (!devServerOrigin) {
        throw new TypeError(
          `devServerOrigin is required when running tests on browser(s)`,
        )
      }
      const devServerStarted = await pingServer(devServerOrigin)
      if (!devServerStarted) {
        throw new Error(
          `dev server not started at ${devServerOrigin}. It is required to run tests`,
        )
      }
    }

    logger.debug(`Generate executions`)
    const executionSteps = await getExecutionAsSteps({
      plan,
      multipleExecutionsOperation,
      rootDirectoryUrl,
    })
    logger.debug(`${executionSteps.length} executions planned`)
    if (completedExecutionLogMerging && !process.stdout.isTTY) {
      completedExecutionLogMerging = false
      logger.debug(
        `Force completedExecutionLogMerging to false because process.stdout.isTTY is false`,
      )
    }
    const debugLogsEnabled = logger.levels.debug
    const executionLogsEnabled = logger.levels.info
    const executionSpinner =
      logRefresh &&
      !debugLogsEnabled &&
      executionLogsEnabled &&
      process.stdout.isTTY &&
      // if there is an error during execution npm will mess up the output
      // (happens when npm runs several command in a workspace)
      // so we enable spinner only when !process.exitCode (no error so far)
      process.exitCode !== 1

    const startMs = Date.now()
    let rawOutput = ""

    logger.info("")
    let executionLog = createLog({ newLine: "" })
    const counters = {
      total: executionSteps.length,
      aborted: 0,
      timedout: 0,
      errored: 0,
      completed: 0,
      done: 0,
    }
    await executeInParallel({
      multipleExecutionsOperation,
      maxExecutionsInParallel,
      cooldownBetweenExecutions,
      executionSteps,
      start: async (paramsFromStep) => {
        const executionIndex = executionSteps.indexOf(paramsFromStep)
        const { executionName, fileRelativeUrl, runtime } = paramsFromStep
        const runtimeType = runtime.type
        const runtimeName = runtime.name
        const runtimeVersion = runtime.version
        const executionParams = {
          measurePerformance: false,
          collectPerformance: false,
          collectConsole: true,
          allocatedMs: defaultMsAllocatedPerExecution,
          ...paramsFromStep,
          runtimeParams: {
            fileRelativeUrl,
            ...paramsFromStep.runtimeParams,
          },
        }
        const beforeExecutionInfo = {
          fileRelativeUrl,
          runtimeType,
          runtimeName,
          runtimeVersion,
          executionIndex,
          executionParams,
          startMs: Date.now(),
          executionResult: {
            status: "executing",
          },
        }
        let spinner
        if (executionSpinner) {
          spinner = startSpinner({
            log: executionLog,
            render: () => {
              return createExecutionLog(beforeExecutionInfo, {
                counters,
                logRuntime,
                logEachDuration,
                ...(logTimeUsage
                  ? {
                      timeEllapsed: Date.now() - startMs,
                    }
                  : {}),
                ...(logMemoryHeapUsage
                  ? { memoryHeap: memoryUsage().heapUsed }
                  : {}),
              })
            },
          })
        }
        beforeExecutionCallback(beforeExecutionInfo)

        const fileUrl = `${rootDirectoryUrl}${fileRelativeUrl}`
        let executionResult
        if (existsSync(new URL(fileUrl))) {
          executionResult = await run({
            signal: multipleExecutionsOperation.signal,
            logger,
            allocatedMs: executionParams.allocatedMs,
            keepRunning,
            mirrorConsole: false, // file are executed in parallel, log would be a mess to read
            collectConsole: executionParams.collectConsole,
            coverageEnabled,
            coverageTempDirectoryUrl,
            runtime: executionParams.runtime,
            runtimeParams: {
              ...runtimeParams,
              ...executionParams.runtimeParams,
            },
          })
        } else {
          executionResult = {
            status: "errored",
            errors: [
              new Error(
                `No file at ${fileRelativeUrl} for execution "${executionName}"`,
              ),
            ],
          }
        }
        counters.done++
        const fileReport = report[fileRelativeUrl]
        if (fileReport) {
          fileReport[executionName] = executionResult
        } else {
          report[fileRelativeUrl] = {
            [executionName]: executionResult,
          }
        }

        const afterExecutionInfo = {
          ...beforeExecutionInfo,
          runtimeVersion: runtime.version,
          endMs: Date.now(),
          executionResult,
        }
        afterExecutionCallback(afterExecutionInfo)

        if (executionResult.status === "aborted") {
          counters.aborted++
        } else if (executionResult.status === "timedout") {
          counters.timedout++
        } else if (executionResult.status === "errored") {
          counters.errored++
        } else if (executionResult.status === "completed") {
          counters.completed++
        }
        if (gcBetweenExecutions) {
          global.gc()
        }
        if (executionLogsEnabled) {
          let log = createExecutionLog(afterExecutionInfo, {
            completedExecutionLogAbbreviation,
            counters,
            logRuntime,
            logEachDuration,
            ...(logTimeUsage
              ? {
                  timeEllapsed: Date.now() - startMs,
                }
              : {}),
            ...(logMemoryHeapUsage
              ? { memoryHeap: memoryUsage().heapUsed }
              : {}),
          })
          log = `${log}
  
`
          const { columns = 80 } = process.stdout
          log = wrapAnsi(log, columns, {
            trim: false,
            hard: true,
            wordWrap: false,
          })

          // replace spinner with this execution result
          if (spinner) spinner.stop()
          executionLog.write(log)
          rawOutput += stripAnsi(log)

          const canOverwriteLog = canOverwriteLogGetter({
            completedExecutionLogMerging,
            executionResult,
          })
          if (canOverwriteLog) {
            // nothing to do, we reuse the current executionLog object
          } else {
            executionLog.destroy()
            executionLog = createLog({ newLine: "" })
          }
        }
        if (
          failFast &&
          executionResult.status !== "completed" &&
          counters.done < counters.total
        ) {
          logger.info(`"failFast" enabled -> cancel remaining executions`)
          failFastAbortController.abort()
        }
      },
    })
    if (!keepRunning) {
      logger.debug("stopAfterAllSignal.notify()")
      await stopAfterAllSignal.notify()
    }

    counters.cancelled = counters.total - counters.done
    const summary = {
      counters,
      // when execution is aborted, the remaining executions are "cancelled"
      duration: Date.now() - startMs,
    }
    if (logSummary) {
      const summaryLog = createSummaryLog(summary)
      rawOutput += stripAnsi(summaryLog)
      logger.info(summaryLog)
    }
    if (summary.counters.total !== summary.counters.completed) {
      const logFileUrl = new URL(logFileRelativeUrl, rootDirectoryUrl).href
      writeFileSync(logFileUrl, rawOutput)
      logger.info(`-> ${urlToFileSystemPath(logFileUrl)}`)
    }
    executePlanReturnValue.aborted = multipleExecutionsOperation.signal.aborted
    executePlanReturnValue.planSummary = summary
    executePlanReturnValue.planReport = report
    await callbacks.reduce(async (previous, callback) => {
      await previous
      await callback()
    }, Promise.resolve())
    return executePlanReturnValue
  } finally {
    await multipleExecutionsOperation.end()
  }
}

const getExecutionAsSteps = async ({
  plan,
  multipleExecutionsOperation,
  rootDirectoryUrl,
}) => {
  try {
    const executionSteps = await generateExecutionSteps(plan, {
      signal: multipleExecutionsOperation.signal,
      rootDirectoryUrl,
    })
    return executionSteps
  } catch (e) {
    if (Abort.isAbortError(e)) {
      return {
        aborted: true,
        planSummary: {},
        planReport: {},
        planCoverage: null,
      }
    }
    throw e
  }
}

const canOverwriteLogGetter = ({
  completedExecutionLogMerging,
  executionResult,
}) => {
  if (!completedExecutionLogMerging) {
    return false
  }
  if (executionResult.status === "aborted") {
    return true
  }
  if (executionResult.status !== "completed") {
    return false
  }
  const { consoleCalls = [] } = executionResult
  if (consoleCalls.length > 0) {
    return false
  }
  return true
}

const executeInParallel = async ({
  multipleExecutionsOperation,
  maxExecutionsInParallel,
  cooldownBetweenExecutions,
  executionSteps,
  start,
}) => {
  const executionResults = []
  let progressionIndex = 0
  let remainingExecutionCount = executionSteps.length

  const nextChunk = async () => {
    if (multipleExecutionsOperation.signal.aborted) {
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
    if (!multipleExecutionsOperation.signal.aborted) {
      executionResults[index] = output
    }
    if (cooldownBetweenExecutions) {
      await new Promise((resolve) =>
        setTimeout(resolve, cooldownBetweenExecutions),
      )
    }
  }

  await nextChunk()

  return executionResults
}
