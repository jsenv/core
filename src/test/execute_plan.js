import { existsSync } from "node:fs"
import { memoryUsage } from "node:process"
import wrapAnsi from "wrap-ansi"
import stripAnsi from "strip-ansi"
import cuid from "cuid"
import { URL_META } from "@jsenv/url-meta"
import { urlToFileSystemPath } from "@jsenv/urls"
import { createDetailedMessage, loggerToLevels } from "@jsenv/logger"
import { createLog, startSpinner } from "@jsenv/log"
import { Abort, raceProcessTeardownEvents } from "@jsenv/abort"
import {
  writeDirectory,
  ensureEmptyDirectory,
  writeFileSync,
} from "@jsenv/filesystem"

import { babelPluginInstrument } from "@jsenv/utils/coverage/babel_plugin_instrument.js"
import { reportToCoverage } from "@jsenv/utils/coverage/report_to_coverage.js"
import { createUrlGraph } from "@jsenv/core/src/omega/url_graph.js"
import { getCorePlugins } from "@jsenv/core/src/plugins/plugins.js"
import { createKitchen } from "@jsenv/core/src/omega/kitchen.js"
import { startOmegaServer } from "@jsenv/core/src/omega/omega_server.js"
import { run } from "@jsenv/core/src/execute/run.js"

import { ensureGlobalGc } from "./gc.js"
import { generateExecutionSteps } from "./execution_steps.js"
import { createExecutionLog, createSummaryLog } from "./logs_file_execution.js"

export const executePlan = async (
  plan,
  {
    signal,
    handleSIGINT,
    logger,
    logSummary,
    logTimeUsage,
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

    scenario,
    sourcemaps,
    plugins,
    injectedGlobals,
    nodeEsmResolution,
    fileSystemMagicResolution,
    transpilation,
    writeGeneratedFiles,

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
        scenario,
        sourcemaps,
        runtimeCompat: runtimes,
        writeGeneratedFiles,
        plugins: [
          ...plugins,
          ...getCorePlugins({
            rootDirectoryUrl,
            urlGraph,
            scenario,
            runtimeCompat: runtimes,

            htmlSupervisor: true,
            nodeEsmResolution,
            fileSystemMagicResolution,
            injectedGlobals,
            transpilation: {
              ...transpilation,
              getCustomBabelPlugins: ({ clientRuntimeCompat }) => {
                if (
                  coverage &&
                  Object.keys(clientRuntimeCompat)[0] !== "chrome"
                ) {
                  return {
                    "transform-instrument": [
                      babelPluginInstrument,
                      {
                        rootDirectoryUrl,
                        coverageConfig,
                      },
                    ],
                  }
                }
                return {}
              },
            },
          }),
        ],
      })
      const server = await startOmegaServer({
        signal: multipleExecutionsOperation.signal,
        logLevel: "warn",
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
    const debugLogsEnabled = loggerToLevels(logger).debug
    const executionLogsEnabled = loggerToLevels(logger).info
    const executionSpinner =
      !debugLogsEnabled &&
      executionLogsEnabled &&
      process.stdout.isTTY &&
      // if there is an error during execution npm will mess up the output
      // (happens when npm runs several command in a workspace)
      // so we enable spinner only when !process.exitCode (no error so far)
      process.exitCode !== 1

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
      const associations = URL_META.resolveAssociations(
        { cover: coverageConfig },
        rootDirectoryUrl,
      )
      const urlShouldBeCovered = (url) => {
        const { cover } = URL_META.applyAssociations({
          url: new URL(url, rootDirectoryUrl).href,
          associations,
        })
        return cover
      }
      runtimeParams.urlShouldBeCovered = urlShouldBeCovered

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
            urlShouldBeCovered,
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
            ...paramsFromStep.runtimeParams,
          },
        }
        const beforeExecutionInfo = {
          fileRelativeUrl,
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
          const renderSpinnerText = () =>
            createExecutionLog(beforeExecutionInfo, {
              counters,
              ...(logTimeUsage
                ? {
                    timeEllapsed: Date.now() - startMs,
                  }
                : {}),
              ...(logMemoryHeapUsage
                ? { memoryHeap: memoryUsage().heapUsed }
                : {}),
            })
          spinner = startSpinner({
            log: executionLog,
            text: renderSpinnerText(),
            update: renderSpinnerText,
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
