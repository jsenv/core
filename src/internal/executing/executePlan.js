import { metaMapToSpecifierMetaMap, normalizeSpecifierMetaMap, urlToMeta } from "@jsenv/url-meta"
import { resolveFileUrl } from "internal/urlUtils.js"
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
  compileDirectoryUrl,
  compileDirectoryClean,
  importMapFileUrl,
  importDefaultExtension,
  babelPluginMap,
  convertMap,
  compileGroupCount,

  plan,
  measurePlanExecutionDuration,
  concurrencyLimit,
  executionDefaultOptions,
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
              url: resolveFileUrl(relativeUrl, projectDirectoryUrl),
              specifierMetaMap: specifierMetaMapForCover,
            }).cover
          },
        }),
      ],
    }
  }

  const [executionSteps, { origin: compileServerOrigin }] = await Promise.all([
    generateExecutionSteps(plan, {
      cancellationToken,
      projectDirectoryUrl,
    }),
    startCompileServerForExecutingPlan({
      cancellationToken,
      logLevel: compileServerLogLevel,
      projectDirectoryUrl,
      compileDirectoryUrl,
      compileDirectoryClean,
      importMapFileUrl,
      importDefaultExtension,
      compileGroupCount,
      babelPluginMap,
      convertMap,
    }),
  ])

  const executionResult = await executeConcurrently(executionSteps, {
    cancellationToken,
    logger,
    launchLogger,
    executeLogger,

    compileServerOrigin,
    projectDirectoryUrl,
    compileDirectoryUrl,
    importMapFileUrl,
    importDefaultExtension,
    babelPluginMap,

    measurePlanExecutionDuration,
    concurrencyLimit,
    executionDefaultOptions,
    logSummary,

    coverage,
    coverageConfig,
    coverageIncludeMissing,
  })

  return executionResult
}
