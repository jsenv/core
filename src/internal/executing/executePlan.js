import { existsSync } from "node:fs"
import { memoryUsage } from "node:process"
import wrapAnsi from "wrap-ansi"
import stripAnsi from "strip-ansi"
import cuid from "cuid"
import { createDetailedMessage, loggerToLevels } from "@jsenv/logger"
import { createLog, startSpinner } from "@jsenv/log"
import {
  Abort,
  raceProcessTeardownEvents,
  createCallbackListNotifiedOnce,
} from "@jsenv/abort"
import {
  urlToFileSystemPath,
  resolveUrl,
  writeDirectory,
  ensureEmptyDirectory,
  normalizeStructuredMetaMap,
  urlToMeta,
  writeFile,
} from "@jsenv/filesystem"

import { startCompileServer } from "../compile_server/startCompileServer.js"
import { babelPluginInstrument } from "./coverage/babel_plugin_instrument.js"
import { generateExecutionSteps } from "./generateExecutionSteps.js"

import { launchAndExecute } from "../executing/launchAndExecute.js"
import { reportToCoverage } from "./coverage/reportToCoverage.js"
import { formatExecuting, formatExecutionResult } from "./executionLogs.js"
import { createSummaryLog } from "./createSummaryLog.js"
import { ensureGlobalGc } from "./gc.js"

export const executePlan = async (
  plan,
  {
    signal,
    handleSIGINT,

    logger,
    compileServerLogLevel,
    launchAndExecuteLogLevel,

    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,
    jsenvDirectoryClean,

    importResolutionMethod,
    importDefaultExtension,

    logSummary,
    logMemoryHeapUsage,
    logFileRelativeUrl,
    completedExecutionLogMerging,
    completedExecutionLogAbbreviation,

    defaultMsAllocatedPerExecution,
    maxExecutionsInParallel,
    failFast,
    gcBetweenExecutions,
    stopAfterExecute,
    cooldownBetweenExecutions,

    coverage,
    coverageConfig,
    coverageIncludeMissing,
    coverageForceIstanbul,
    coverageV8ConflictWarning,
    coverageTempDirectoryRelativeUrl,

    protocol,
    privateKey,
    certificate,
    ip,
    port,
    compileServerCanReadFromFilesystem,
    compileServerCanWriteOnFilesystem,
    babelPluginMap,
    babelConfigFileUrl,
    preservedUrls,
    workers,
    serviceWorkers,
    importMapInWebWorkers,
    customCompilers,

    beforeExecutionCallback = () => {},
    afterExecutionCallback = () => {},
  } = {},
) => {
  if (coverage) {
    babelPluginMap = {
      ...babelPluginMap,
      "transform-instrument": [
        babelPluginInstrument,
        { projectDirectoryUrl, coverageConfig },
      ],
    }
  }
  const runtimes = {}
  Object.keys(plan).forEach((filePattern) => {
    const filePlan = plan[filePattern]
    Object.keys(filePlan).forEach((executionName) => {
      const executionConfig = filePlan[executionName]
      const { runtime } = executionConfig
      if (runtime) {
        runtimes[runtime.name] = runtime.version
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
    const compileServer = await startCompileServer({
      signal: multipleExecutionsOperation.signal,
      logLevel: compileServerLogLevel,

      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      jsenvDirectoryClean,

      importResolutionMethod,
      importDefaultExtension,

      protocol,
      privateKey,
      certificate,
      ip,
      port,
      compileServerCanReadFromFilesystem,
      compileServerCanWriteOnFilesystem,
      keepProcessAlive: true, // to be sure it stays alive
      babelPluginMap,
      babelConfigFileUrl,
      preservedUrls,
      workers,
      serviceWorkers,
      importMapInWebWorkers,
      customCompilers,
    })
    babelPluginMap = compileServer.babelPluginMap
    multipleExecutionsOperation.addEndCallback(async () => {
      await compileServer.stop()
    })
    logger.debug(`Generate executions`)
    const executionSteps = await getExecutionAsSteps({
      plan,
      compileServer,
      multipleExecutionsOperation,
      projectDirectoryUrl,
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
    const executionCount = executionSteps.length
    let rawOutput = ""

    let transformReturnValue = (value) => value

    if (gcBetweenExecutions) {
      ensureGlobalGc()
    }

    const coverageTempDirectoryUrl = resolveUrl(
      coverageTempDirectoryRelativeUrl,
      projectDirectoryUrl,
    )
    const structuredMetaMapForCover = normalizeStructuredMetaMap(
      {
        cover: coverageConfig,
      },
      projectDirectoryUrl,
    )
    const coverageIgnorePredicate = (url) => {
      return !urlToMeta({
        url: resolveUrl(url, projectDirectoryUrl),
        structuredMetaMap: structuredMetaMapForCover,
      }).cover
    }

    if (coverage) {
      // in case runned multiple times, we don't want to keep writing lot of files in this directory
      if (!process.env.NODE_V8_COVERAGE) {
        await ensureEmptyDirectory(coverageTempDirectoryUrl)
      }
      if (runtimes.node) {
        // v8 coverage is written in a directoy and auto propagate to subprocesses
        // through process.env.NODE_V8_COVERAGE.
        if (!coverageForceIstanbul && !process.env.NODE_V8_COVERAGE) {
          const v8CoverageDirectory = resolveUrl(
            `./node_v8/${cuid()}`,
            coverageTempDirectoryUrl,
          )
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
            projectDirectoryUrl,
            babelPluginMap,
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
    let abortedCount = 0
    let timedoutCount = 0
    let erroredCount = 0
    let completedCount = 0
    const stopAfterAllExecutionCallbackList = createCallbackListNotifiedOnce()

    let executionDoneCount = 0
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
          // the params below can be overriden by executionDefaultParams
          measurePerformance: false,
          collectPerformance: false,
          captureConsole: true,
          stopAfterExecute,
          stopAfterExecuteReason: "execution-done",
          allocatedMs: defaultMsAllocatedPerExecution,
          ...paramsFromStep,
          runtime,
          // mirrorConsole: false because file will be executed in parallel
          // so log would be a mess to read
          mirrorConsole: false,
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
              executionCount,
              abortedCount,
              timedoutCount,
              erroredCount,
              completedCount,
              ...(logMemoryHeapUsage
                ? { memoryHeap: memoryUsage().heapUsed }
                : {}),
            }),
          })
        }
        beforeExecutionCallback(beforeExecutionInfo)

        const filePath = urlToFileSystemPath(
          `${projectDirectoryUrl}${fileRelativeUrl}`,
        )
        let executionResult
        if (existsSync(filePath)) {
          executionResult = await launchAndExecute({
            signal: multipleExecutionsOperation.signal,
            launchAndExecuteLogLevel,

            ...executionParams,
            collectCoverage: coverage,
            coverageTempDirectoryUrl,
            runtimeParams: {
              projectDirectoryUrl,
              compileServerOrigin: compileServer.origin,
              compileServerId: compileServer.id,
              jsenvDirectoryRelativeUrl:
                compileServer.jsenvDirectoryRelativeUrl,

              collectCoverage: coverage,
              coverageIgnorePredicate,
              coverageForceIstanbul,
              stopAfterAllExecutionCallbackList,
              ...executionParams.runtimeParams,
            },
            executeParams: {
              fileRelativeUrl,
              ...executionParams.executeParams,
            },
            coverageV8ConflictWarning,
          })
        } else {
          executionResult = {
            status: "errored",
            error: new Error(
              `No file at ${fileRelativeUrl} for execution "${executionName}"`,
            ),
          }
        }
        executionDoneCount++
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
          abortedCount++
        } else if (executionResult.status === "timedout") {
          timedoutCount++
        } else if (executionResult.status === "errored") {
          erroredCount++
        } else if (executionResult.status === "completed") {
          completedCount++
        }
        if (gcBetweenExecutions) {
          global.gc()
        }
        if (executionLogsEnabled) {
          let log = formatExecutionResult(afterExecutionInfo, {
            completedExecutionLogAbbreviation,
            executionCount,
            abortedCount,
            timedoutCount,
            erroredCount,
            completedCount,
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
          executionDoneCount < executionCount
        ) {
          logger.info(`"failFast" enabled -> cancel remaining executions`)
          failFastAbortController.abort()
        }
      },
    })

    if (stopAfterExecute) {
      stopAfterAllExecutionCallbackList.notify()
    }

    const summaryCounts = reportToSummary(report)
    const summary = {
      executionCount,
      ...summaryCounts,
      // when execution is aborted, the remaining executions are "cancelled"
      cancelledCount: executionCount - executionDoneCount,
      duration: Date.now() - startMs,
    }
    if (logSummary) {
      const summaryLog = createSummaryLog(summary)
      rawOutput += stripAnsi(summaryLog)
      logger.info(summaryLog)
    }
    if (summary.executionCount !== summary.completedCount) {
      const logFileUrl = new URL(logFileRelativeUrl, projectDirectoryUrl)
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
  compileServer,
  multipleExecutionsOperation,
  projectDirectoryUrl,
}) => {
  try {
    const executionSteps = await generateExecutionSteps(
      {
        ...plan,
        [compileServer.jsenvDirectoryRelativeUrl]: null,
      },
      {
        signal: multipleExecutionsOperation.signal,
        projectDirectoryUrl,
      },
    )
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

const reportToSummary = (report) => {
  const fileNames = Object.keys(report)
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
  const abortedCount = countResultMatching(({ status }) => status === "aborted")
  const timedoutCount = countResultMatching(
    ({ status }) => status === "timedout",
  )
  const erroredCount = countResultMatching(({ status }) => status === "errored")
  const completedCount = countResultMatching(
    ({ status }) => status === "completed",
  )
  return {
    abortedCount,
    timedoutCount,
    erroredCount,
    completedCount,
  }
}
