import {
  Abortable,
  raceProcessTeardownEvents,
} from "@jsenv/core/src/abort/main.js"
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

    defaultMsAllocatedPerExecution,
    maxExecutionsInParallel,
    completedExecutionLogMerging,
    completedExecutionLogAbbreviation,
    logSummary,
    measureGlobalDuration,

    coverage,
    coverageConfig,
    coverageIncludeMissing,
    coverageForceIstanbul,
    coverageV8MergeConflictIsExpected,

    compileServerProtocol,
    compileServerPrivateKey,
    compileServerCertificate,
    compileServerIp,
    compileServerPort,
    compileServerCanReadFromFilesystem,
    compileServerCanWriteOnFilesystem,
    babelPluginMap,
    babelConfigFileUrl,
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

  const multipleExecutionsOperation = Abortable.fromSignal(signal)
  if (handleSIGINT) {
    Abortable.effect(multipleExecutionsOperation, (cb) =>
      raceProcessTeardownEvents(
        {
          SIGINT: true,
        },
        cb,
      ),
    )
  }

  const compileServer = await startCompileServer({
    signal: multipleExecutionsOperation.signal,
    compileServerLogLevel,

    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,
    jsenvDirectoryClean,
    outDirectoryName: "out-dev",

    importResolutionMethod,
    importDefaultExtension,

    compileServerProtocol,
    compileServerPrivateKey,
    compileServerCertificate,
    compileServerIp,
    compileServerPort,
    compileServerCanReadFromFilesystem,
    compileServerCanWriteOnFilesystem,
    keepProcessAlive: true, // to be sure it stays alive
    babelPluginMap,
    babelConfigFileUrl,
    customCompilers,
    runtimeSupport,
  })

  multipleExecutionsOperation.cleaner.addCallback(async () => {
    await compileServer.stop()
  })

  const executionSteps = await generateExecutionSteps(
    {
      ...plan,
      [compileServer.outDirectoryRelativeUrl]: null,
    },
    {
      signal: multipleExecutionsOperation.signal,
      projectDirectoryUrl,
    },
  )

  const result = await executeConcurrently(executionSteps, {
    multipleExecutionsOperation,
    logger,
    launchAndExecuteLogLevel,

    projectDirectoryUrl,
    compileServerOrigin: compileServer.origin,
    outDirectoryRelativeUrl: compileServer.outDirectoryRelativeUrl,

    // not sure we actually have to pass import params to executeConcurrently
    importResolutionMethod,
    importDefaultExtension,

    babelPluginMap: compileServer.babelPluginMap,

    defaultMsAllocatedPerExecution,
    maxExecutionsInParallel,
    completedExecutionLogMerging,
    completedExecutionLogAbbreviation,
    logSummary,
    measureGlobalDuration,

    coverage,
    coverageConfig,
    coverageIncludeMissing,
    coverageForceIstanbul,
    coverageV8MergeConflictIsExpected,
  })

  // (used to stop potential chrome browser still opened to be reused)
  multipleExecutionsOperation.cleaner.clean("all execution done")

  return {
    planSummary: result.summary,
    planReport: result.report,
    planCoverage: result.coverage,
  }
}
