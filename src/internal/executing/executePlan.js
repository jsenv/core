import { urlToRelativeUrl } from "@jsenv/util"
import { fetchUrl } from "../fetchUrl.js"
import { COMPILE_ID_GLOBAL_BUNDLE, COMPILE_ID_COMMONJS_BUNDLE } from "../CONSTANTS.js"
import { startCompileServer } from "../compiling/startCompileServer.js"
import { browserJsFileUrl, nodeJsFileUrl } from "../jsenvInternalFiles.js"
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
  })

  const internalFilesToPing = []
  const browserRuntimeAnticipatedGeneration = Object.keys(plan).some((key) => key.endsWith(".html"))
  if (browserRuntimeAnticipatedGeneration) {
    const browserJsFileRelativeUrl = urlToRelativeUrl(browserJsFileUrl, projectDirectoryUrl)
    internalFilesToPing.push(
      `${compileServerOrigin}/${outDirectoryRelativeUrl}${COMPILE_ID_GLOBAL_BUNDLE}/${browserJsFileRelativeUrl}`,
    )
  }
  const nodeRuntimeAnticipatedGeneration = Object.keys(plan).some(
    (key) => key.endsWith(".js") || key.endsWith(".jsx") || key.endsWith(".ts"),
  )
  if (nodeRuntimeAnticipatedGeneration) {
    const nodeJsFileRelativeUrl = urlToRelativeUrl(nodeJsFileUrl, projectDirectoryUrl)
    internalFilesToPing.push(
      `${compileServerOrigin}/${outDirectoryRelativeUrl}${COMPILE_ID_COMMONJS_BUNDLE}/${nodeJsFileRelativeUrl}`,
    )
  }

  if (internalFilesToPing.length) {
    logger.info(`preparing jsenv internal files (${internalFilesToPing.length})...`)
    await internalFilesToPing.reduce(async (previous, internalFileUrl) => {
      await previous
      logger.debug(`ping internal file at ${internalFileUrl} to have it in filesystem cache`)
      return fetchUrl(internalFileUrl, { ignoreHttpsError: true })
    }, Promise.resolve())
  }

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
