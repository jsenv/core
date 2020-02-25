import {
  resolveUrl,
  metaMapToSpecifierMetaMap,
  normalizeSpecifierMetaMap,
  urlToMeta,
} from "@jsenv/util"
import { createInstrumentBabelPlugin } from "./coverage/createInstrumentBabelPlugin.js"
import { generateExecutionSteps } from "./generateExecutionSteps.js"
import { startCompileServerForExecutingPlan } from "./startCompileServerForExecutingPlan.js"
import { executeConcurrently } from "./executeConcurrently.js"

export const executePlan = async ({
  cancellationToken,
  compileServerLogLevel,
  logger,
  launchLogger,
  executeLogger,

  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean,
  importMapFileUrl,
  importDefaultExtension,

  compileServerProtocol,
  compileServerPrivateKey,
  compileServerCertificate,
  compileServerIp,
  compileServerPort,
  babelPluginMap,
  convertMap,
  compileGroupCount,

  plan,
  concurrencyLimit,
  executionDefaultOptions,
  stopPlatformAfterExecute,
  completedExecutionLogMerging,
  completedExecutionLogAbbreviation,
  logSummary,

  // coverage parameters
  coverage,
  coverageConfig,
  coverageIncludeMissing,
} = {}) => {
  if (coverage) {
    const specifierMetaMapForCover = normalizeSpecifierMetaMap(
      metaMapToSpecifierMetaMap({
        cover: coverageConfig,
      }),
      projectDirectoryUrl,
    )

    babelPluginMap = {
      ...babelPluginMap,
      "transform-instrument": [
        createInstrumentBabelPlugin({
          predicate: ({ relativeUrl }) => {
            return urlToMeta({
              url: resolveUrl(relativeUrl, projectDirectoryUrl),
              specifierMetaMap: specifierMetaMapForCover,
            }).cover
          },
        }),
      ],
    }
  }

  const [
    executionSteps,
    { origin: compileServerOrigin, outDirectoryRelativeUrl, stop },
  ] = await Promise.all([
    generateExecutionSteps(plan, {
      cancellationToken,
      projectDirectoryUrl,
    }),
    startCompileServerForExecutingPlan({
      cancellationToken,
      compileServerLogLevel,

      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      jsenvDirectoryClean,
      importMapFileUrl,
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
    }),
  ])

  const executionResult = await executeConcurrently(executionSteps, {
    cancellationToken,
    logger,
    launchLogger,
    executeLogger,

    projectDirectoryUrl,
    outDirectoryRelativeUrl,
    compileServerOrigin,
    importMapFileUrl,
    importDefaultExtension,

    babelPluginMap,

    stopPlatformAfterExecute,
    concurrencyLimit,
    executionDefaultOptions,
    completedExecutionLogMerging,
    completedExecutionLogAbbreviation,
    logSummary,

    coverage,
    coverageConfig,
    coverageIncludeMissing,
  })

  stop("all execution done")

  return executionResult
}
