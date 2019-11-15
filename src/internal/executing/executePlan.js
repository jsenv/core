import { metaMapToSpecifierMetaMap, normalizeSpecifierMetaMap, urlToMeta } from "@jsenv/url-meta"
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
  importMapFileRelativePath,
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
  coverageAndExecutionAllowed,
} = {}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`)
  }
  if (typeof compileDirectoryUrl !== "string") {
    throw new TypeError(`compileDirectoryUrl must be a string, got ${compileDirectoryUrl}`)
  }

  if (coverage) {
    if (typeof coverageConfig !== "object") {
      throw new TypeError(`coverageConfig must be an object, got ${coverageConfig}`)
    }
    if (Object.keys(coverageConfig).length === 0) {
      logger.warn(
        `coverageConfig is an empty object. Nothing will be instrumented for coverage so your coverage will be empty`,
      )
    }
    if (!coverageAndExecutionAllowed) {
      ensureNoFileWillBeBothCoveredAndExecuted({
        coverageConfig,
        plan,
      })
    }

    const specifierMetaMapForCover = normalizeSpecifierMetaMap(
      metaMapToSpecifierMetaMap({
        cover: coverageConfig,
      }),
      projectDirectoryUrl,
    )

    const coverRelativePathPredicate = (relativePath) =>
      urlToMeta({
        url: `${projectDirectoryUrl}${relativePath}`,
        specifierMetaMap: specifierMetaMapForCover,
      }).cover

    babelPluginMap = {
      ...babelPluginMap,
      "transform-instrument": [
        createInstrumentBabelPlugin({
          predicate: ({ relativePath }) => {
            return coverRelativePathPredicate(relativePath)
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
      importMapFileRelativePath,
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
    importMapFileRelativePath,
    importDefaultExtension,
    babelPluginMap,

    measurePlanExecutionDuration,
    concurrencyLimit,
    executionDefaultOptions,
    logSummary,

    coverage,
    coverageConfig,
    coverageAndExecutionAllowed,
  })

  return executionResult
}

const ensureNoFileWillBeBothCoveredAndExecuted = ({ plan, coverageConfig }) => {
  const fileSpecifierMapForExecute = normalizeSpecifierMetaMap(
    metaMapToSpecifierMetaMap({
      execute: plan,
    }),
    "file:///",
  )

  const fileSpecifierMapForCover = normalizeSpecifierMetaMap(
    metaMapToSpecifierMetaMap({
      cover: coverageConfig,
    }),
    "file:///",
  )

  const fileSpecifierMatchingCoverAndExecuteArray = Object.keys(fileSpecifierMapForExecute).filter(
    (fileUrl) => {
      return urlToMeta({
        url: fileUrl,
        specifierMetaMap: fileSpecifierMapForCover,
      }).cover
    },
  )

  if (fileSpecifierMatchingCoverAndExecuteArray.length) {
    // I think it is an error, it would be strange, for a given file
    // to be both covered and executed
    throw new Error(`some file will be both covered and executed
--- specifiers ---
${fileSpecifierMatchingCoverAndExecuteArray.join("\n")}`)
  }
}
