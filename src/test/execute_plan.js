import { existsSync } from "node:fs"
import { memoryUsage } from "node:process"
import wrapAnsi from "wrap-ansi"
import stripAnsi from "strip-ansi"
import cuid from "cuid"
import {
  urlToFileSystemPath,
  writeDirectory,
  ensureEmptyDirectory,
  normalizeStructuredMetaMap,
  urlToMeta,
  writeFile,
} from "@jsenv/filesystem"
import {
  createLogger,
  createDetailedMessage,
  loggerToLevels,
} from "@jsenv/logger"
import { createLog, startSpinner } from "@jsenv/log"
import { Abort, raceProcessTeardownEvents } from "@jsenv/abort"

import { createUrlGraph } from "@jsenv/core/src/utils/url_graph/url_graph.js"
import { createKitchen } from "@jsenv/core/src/omega/kitchen/kitchen.js"
import { getCorePlugins } from "@jsenv/core/src/omega/core_plugins.js"
import { startOmegaServer } from "@jsenv/core/src/omega/server.js"
import { run } from "@jsenv/core/src/execute/run.js"
import { babelPluginInstrument } from "@jsenv/core/src/utils/coverage/babel_plugin_instrument.js"
import { reportToCoverage } from "@jsenv/core/src/utils/coverage/report_to_coverage.js"

import { ensureGlobalGc } from "./gc.js"
import { generateExecutionSteps } from "./execution_steps.js"
import {
  formatExecuting,
  formatExecutionResult,
  createSummaryLog,
} from "./logs_file_execution.js"

export const executePlan = async (
  plan,
  {
    signal,
    handleSIGINT,
    logger,
    logSummary,
    logMemoryHeapUsage,
    logFileRelativeUrl,
    completedExecutionLogMerging,
    completedExecutionLogAbbreviation,

    rootDirectoryUrl,
    keepRunning,
    defaultMsAllocatedPerExecution,
    maxExecutionsInParallel,
    failFast,
    gcBetweenExecutions,
    cooldownBetweenExecutions,

    coverage,
    coverageConfig,
    coverageIncludeMissing,
    coverageForceIstanbul,
    coverageV8ConflictWarning,
    coverageTempDirectoryRelativeUrl,

    plugins = [],
    scenario = "test",
    sourcemaps = "inline",

    protocol,
    privateKey,
    certificate,
    ip,
    port,

    beforeExecutionCallback = () => {},
    afterExecutionCallback = () => {},
  } = {},
) => {
  const stopAfterAllSignal = { notify: () => {} }

  let someNeedsServer = false
  const runtimes = {}
  Object.keys(plan).forEach((filePattern) => {
    const filePlan = plan[filePattern]
    Object.keys(filePlan).forEach((executionName) => {
      const executionConfig = filePlan[executionName]
      const { runtime } = executionConfig
      if (runtime) {
        runtimes[runtime.name] = runtime.version
        if (runtime.needsServer) {
          someNeedsServer = true
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
    let runtimeParams = {
      rootDirectoryUrl,
      collectCoverage: coverage,
      coverageForceIstanbul,
      stopAfterAllSignal,
    }
    if (someNeedsServer) {
      const urlGraph = createUrlGraph()
      const kitchen = createKitchen({
        signal,
        logger,
        rootDirectoryUrl,
        urlGraph,
        plugins: [
          ...plugins,
          ...getCorePlugins({
            babel: {
              customBabelPlugins: [
                ...(coverage
                  ? [
                      babelPluginInstrument,
                      {
                        rootDirectoryUrl,
                        coverageConfig,
                      },
                    ]
                  : []),
              ],
            },
          }),
        ],
        scenario,
        sourcemaps,
      })
      const serverLogger = createLogger({ logLevel: "warn" })
      const server = await startOmegaServer({
        signal: multipleExecutionsOperation.signal,
        logger: serverLogger,
        rootDirectoryUrl,
        urlGraph,
        kitchen,
        scenario,
        keepProcessAlive: false,
        port,
        ip,
        protocol,
        certificate,
        privateKey,
      })
      multipleExecutionsOperation.addEndCallback(async () => {
        await server.stop()
      })
      runtimeParams = {
        ...runtimeParams,
        server,
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
    const executionLogsEnabled = loggerToLevels(logger).info
    const executionSpinner = executionLogsEnabled && process.stdout.isTTY

    const startMs = Date.now()
    const report = {}
    let rawOutput = ""

    let transformReturnValue = (value) => value
    if (gcBetweenExecutions) {
      ensureGlobalGc()
    }

    const coverageTempDirectoryUrl = new URL(
      coverageTempDirectoryRelativeUrl,
      rootDirectoryUrl,
    ).href

    if (coverage) {
      const structuredMetaMapForCover = normalizeStructuredMetaMap(
        {
          cover: coverageConfig,
        },
        rootDirectoryUrl,
      )
      const coverageIgnorePredicate = (url) => {
        return !urlToMeta({
          url: new URL(url, rootDirectoryUrl).href,
          structuredMetaMap: structuredMetaMapForCover,
        }).cover
      }
      runtimeParams.coverageIgnorePredicate = coverageIgnorePredicate

      // in case runned multiple times, we don't want to keep writing lot of files in this directory
      if (!process.env.NODE_V8_COVERAGE) {
        await ensureEmptyDirectory(coverageTempDirectoryUrl)
      }
      if (runtimes.node) {
        // v8 coverage is written in a directoy and auto propagate to subprocesses
        // through process.env.NODE_V8_COVERAGE.
        if (!coverageForceIstanbul && !process.env.NODE_V8_COVERAGE) {
          const v8CoverageDirectory = new URL(
            `./node_v8/${cuid()}`,
            coverageTempDirectoryUrl,
          ).href
          await writeDirectory(v8CoverageDirectory, { allowUseless: true })
          process.env.NODE_V8_COVERAGE =
            urlToFileSystemPath(v8CoverageDirectory)
        }
      }
      transformReturnValue = async (value) => {
        if (multipleExecutionsOperation.signal.aborted) {
          // don't try to do the coverage stuff
          return value
        }
        try {
          value.coverage = await reportToCoverage(value.report, {
            signal: multipleExecutionsOperation.signal,
            logger,
            rootDirectoryUrl,
            coverageConfig,
            coverageIncludeMissing,
            coverageForceIstanbul,
            coverageIgnorePredicate,
            coverageV8ConflictWarning,
          })
        } catch (e) {
          if (Abort.isAbortError(e)) {
            return value
          }
          throw e
        }
        return value
      }
    }

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
          },
        }
        const beforeExecutionInfo = {
          fileRelativeUrl,
          runtimeName,
          runtimeVersion,
          executionIndex,
          executionParams,
        }
        let spinner
        if (executionSpinner) {
          spinner = startSpinner({
            log: executionLog,
            text: formatExecuting(beforeExecutionInfo, {
              counters,
              ...(logMemoryHeapUsage
                ? { memoryHeap: memoryUsage().heapUsed }
                : {}),
            }),
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
            collectCoverage: coverage,
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
            error: new Error(
              `No file at ${fileRelativeUrl} for execution "${executionName}"`,
            ),
          }
        }
        counters.done++
        if (fileRelativeUrl in report === false) {
          report[fileRelativeUrl] = {}
        }
        report[fileRelativeUrl][executionName] = executionResult
        const afterExecutionInfo = {
          ...beforeExecutionInfo,
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
          let log = formatExecutionResult(afterExecutionInfo, {
            completedExecutionLogAbbreviation,
            counters,
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
      writeFile(logFileUrl, rawOutput)
      logger.info(`-> ${urlToFileSystemPath(logFileUrl)}`)
    }
    const result = await transformReturnValue({
      summary,
      report,
    })
    return {
      aborted: multipleExecutionsOperation.signal.aborted,
      planSummary: result.summary,
      planReport: result.report,
      planCoverage: result.coverage,
    }
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
