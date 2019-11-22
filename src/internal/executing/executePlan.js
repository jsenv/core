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
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean,
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

  const [
    executionSteps,
    { origin: compileServerOrigin, compileServerJsenvDirectoryUrl },
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

    projectDirectoryUrl,
    importMapFileUrl,
    importDefaultExtension,

    babelPluginMap,
    compileServerOrigin,
    compileServerJsenvDirectoryUrl,

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
