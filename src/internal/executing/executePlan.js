import { startCompileServer } from "../compiling/startCompileServer.js"
import { babelPluginInstrument } from "./coverage/babel-plugin-instrument.js"
import { generateExecutionSteps } from "./generateExecutionSteps.js"
import { executeConcurrently } from "./executeConcurrently.js"

export const executePlan = async (
  plan,
  {
    cancellationToken,
    compileServerLogLevel,
    logger,
    executionLogLevel,

    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,
    jsenvDirectoryClean,
    importMapFileRelativeUrl,
    importDefaultExtension,

    compileServerProtocol,
    compileServerPrivateKey,
    compileServerCertificate,
    compileServerIp,
    compileServerPort,
    babelPluginMap,
    convertMap,
    compileGroupCount,

    concurrencyLimit,
    executionDefaultOptions,
    stopAfterExecute,
    completedExecutionLogMerging,
    completedExecutionLogAbbreviation,
    logSummary,

    // coverage parameters
    coverage,
    coverageConfig,
    coverageIncludeMissing,

    ...rest
  } = {},
) => {
  if (coverage) {
    babelPluginMap = {
      ...babelPluginMap,
      "transform-instrument": [babelPluginInstrument, { projectDirectoryUrl, coverageConfig }],
    }
  }

  const { origin: compileServerOrigin, outDirectoryRelativeUrl, stop } = await startCompileServer({
    cancellationToken,
    compileServerLogLevel,

    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,
    jsenvDirectoryClean,
    importMapFileRelativeUrl,
    importDefaultExtension,

    compileServerProtocol,
    compileServerPrivateKey,
    compileServerCertificate,
    compileServerIp,
    compileServerPort,
    keepProcessAlive: true, // to be sure it stays alive
    babelPluginMap,
    convertMap,
    compileGroupCount,

    browserInternalFileAnticipation: Object.keys(plan).some((key) => key.endsWith(".html")),
    nodeInternalFileAnticipation: Object.keys(plan).some(
      (key) => key.endsWith(".js") || key.endsWith(".jsx") || key.endsWith(".ts"),
    ),
  })

  const executionSteps = await generateExecutionSteps(
    {
      ...plan,
      [outDirectoryRelativeUrl]: null,
    },
    {
      cancellationToken,
      projectDirectoryUrl,
    },
  )

  const executionResult = await executeConcurrently(executionSteps, {
    cancellationToken,
    logger,
    executionLogLevel,

    projectDirectoryUrl,
    outDirectoryRelativeUrl,
    compileServerOrigin,
    importMapFileRelativeUrl,
    importDefaultExtension,

    babelPluginMap,

    stopAfterExecute,
    concurrencyLimit,
    executionDefaultOptions,
    completedExecutionLogMerging,
    completedExecutionLogAbbreviation,
    logSummary,

    coverage,
    coverageConfig,
    coverageIncludeMissing,

    ...rest,
  })

  stop("all execution done")

  return executionResult
}
