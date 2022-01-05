import { Abort, raceProcessTeardownEvents } from "@jsenv/abort"
import { createDetailedMessage } from "@jsenv/logger"

import { mergeRuntimeSupport } from "@jsenv/core/src/internal/generateGroupMap/runtime_support.js"
import { startCompileServer } from "../compiling/startCompileServer.js"
import { babelPluginInstrument } from "./coverage/babel_plugin_instrument.js"
import { generateExecutionSteps } from "./generateExecutionSteps.js"
import { executeConcurrently } from "./executeConcurrently.js"

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
    completedExecutionLogMerging,
    completedExecutionLogAbbreviation,

    defaultMsAllocatedPerExecution,
    maxExecutionsInParallel,
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
    workers,
    serviceWorkers,
    importMapInWebWorkers,
    customCompilers,
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

  const runtimeSupport = {}
  Object.keys(plan).forEach((filePattern) => {
    const filePlan = plan[filePattern]
    Object.keys(filePlan).forEach((executionName) => {
      const executionConfig = filePlan[executionName]
      const { runtime } = executionConfig
      if (runtime) {
        mergeRuntimeSupport(runtimeSupport, {
          [runtime.name]: runtime.version,
        })
      }
    })
  })

  logger.debug(
    createDetailedMessage(`Prepare executing plan`, {
      runtimeSupport: JSON.stringify(runtimeSupport, null, "  "),
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

  try {
    const compileServer = await startCompileServer({
      signal: multipleExecutionsOperation.signal,
      logLevel: compileServerLogLevel,

      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      jsenvDirectoryClean,
      outDirectoryName: "dev",

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
      workers,
      serviceWorkers,
      importMapInWebWorkers,
      customCompilers,
      runtimeSupport,
    })

    multipleExecutionsOperation.addEndCallback(async () => {
      await compileServer.stop()
    })

    logger.debug(`Generate executions`)

    let executionSteps
    try {
      executionSteps = await generateExecutionSteps(
        {
          ...plan,
          [compileServer.outDirectoryRelativeUrl]: null,
        },
        {
          signal: multipleExecutionsOperation.signal,
          projectDirectoryUrl,
        },
      )
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
    logger.debug(`${executionSteps.length} executions planned`)

    const result = await executeConcurrently(executionSteps, {
      multipleExecutionsOperation,
      logger,
      launchAndExecuteLogLevel,

      projectDirectoryUrl,
      compileServer,

      // not sure we actually have to pass import params to executeConcurrently
      importResolutionMethod,
      importDefaultExtension,

      babelPluginMap: compileServer.babelPluginMap,

      logSummary,
      logMemoryHeapUsage,
      completedExecutionLogMerging,
      completedExecutionLogAbbreviation,

      defaultMsAllocatedPerExecution,
      maxExecutionsInParallel,
      stopAfterExecute,
      gcBetweenExecutions,
      cooldownBetweenExecutions,

      coverage,
      coverageConfig,
      coverageIncludeMissing,
      coverageForceIstanbul,
      coverageV8ConflictWarning,
      coverageTempDirectoryRelativeUrl,
      runtimeSupport,
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
