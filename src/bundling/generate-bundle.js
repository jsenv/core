import { operatingSystemPathToPathname } from "@jsenv/operating-system-path"
import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../cancellationHelper.js"
import { generateGroupMap } from "../group-map/index.js"
import { LOG_LEVEL_ERRORS_WARNINGS_AND_LOGS } from "../logger.js"
import { bundleWithRollup } from "./bundleWithRollup.js"
import { computeRollupOptionsForBalancer } from "./computeRollupOptionsForBalancer.js"
import { computeRollupOptionsWithBalancing } from "./computeRollupOptionsWithBalancing.js"
import { computeRollupOptionsWithoutBalancing } from "./computeRollupOptionsWithoutBalancing.js"
import {
  DEFAULT_IMPORT_MAP_RELATIVE_PATH,
  DEFAULT_PLATFORM_GROUP_RESOLVER_RELATIVE_PATH,
  DEFAULT_ENTRY_POINT_MAP,
  DEFAULT_NATIVE_MODULE_PREDICATE,
  DEFAULT_BABEL_PLUGIN_MAP,
  DEFAULT_PLATFORM_SCORE_MAP,
} from "./generate-bundle-constant.js"

export const generateBundle = ({
  projectPath,
  bundleIntoRelativePath,
  importMapRelativePath = DEFAULT_IMPORT_MAP_RELATIVE_PATH,
  inlineSpecifierMap = {},
  nativeModulePredicate = DEFAULT_NATIVE_MODULE_PREDICATE,
  entryPointMap = DEFAULT_ENTRY_POINT_MAP,
  babelPluginMap = DEFAULT_BABEL_PLUGIN_MAP,
  logLevel = LOG_LEVEL_ERRORS_WARNINGS_AND_LOGS,
  minify = false,
  writeOnFileSystem = true,
  throwUnhandled = true,
  format,
  formatOutputOptions = {},
  // balancing
  compileGroupCount = 1,
  balancerTemplateRelativePath,
  balancerDataClientPathname,
  platformScoreMap = DEFAULT_PLATFORM_SCORE_MAP,
  platformGroupResolverRelativePath = DEFAULT_PLATFORM_GROUP_RESOLVER_RELATIVE_PATH,
}) => {
  const promise = catchAsyncFunctionCancellation(async () => {
    if (typeof projectPath !== "string")
      throw new TypeError(`projectPath must be a string, got ${projectPath}`)
    if (typeof bundleIntoRelativePath !== "string")
      throw new TypeError(`bundleIntoRelativePath must be a string, got ${bundleIntoRelativePath}`)
    if (typeof entryPointMap !== "object")
      throw new TypeError(`entryPointMap must be an object, got ${entryPointMap}`)
    if (typeof compileGroupCount !== "number")
      throw new TypeError(`compileGroupCount must be a number, got ${compileGroupCount}`)
    if (compileGroupCount < 1)
      throw new Error(`compileGroupCount must be >= 1, got ${compileGroupCount}`)

    const projectPathname = operatingSystemPathToPathname(projectPath)
    const cancellationToken = createProcessInterruptionCancellationToken()

    if (compileGroupCount === 1) {
      return await bundleWithRollup({
        cancellationToken,
        writeOnFileSystem,
        ...computeRollupOptionsWithoutBalancing({
          cancellationToken,
          projectPathname,
          bundleIntoRelativePath,
          importMapRelativePath,
          inlineSpecifierMap,
          nativeModulePredicate,
          entryPointMap,
          babelPluginMap,
          minify,
          logLevel,
          format,
          formatOutputOptions,
        }),
      })
    }

    if (!balancerTemplateRelativePath) {
      throw new Error(`format not compatible with balancing.
format: ${format}
compileGroupCount: ${compileGroupCount}`)
    }

    const groupMap = generateGroupMap({
      babelPluginMap,
      platformScoreMap,
      groupCount: compileGroupCount,
    })

    return await Promise.all([
      generateEntryPointsFolders({
        cancellationToken,
        projectPathname,
        bundleIntoRelativePath,
        importMapRelativePath,
        inlineSpecifierMap,
        nativeModulePredicate,
        entryPointMap,
        babelPluginMap,
        minify,
        logLevel,
        writeOnFileSystem,
        format,
        formatOutputOptions,
        groupMap,
      }),
      generateEntryPointsBalancerFiles({
        cancellationToken,
        projectPathname,
        bundleIntoRelativePath,
        importMapRelativePath,
        nativeModulePredicate,
        entryPointMap,
        babelPluginMap,
        minify,
        logLevel,
        writeOnFileSystem,
        format,
        platformGroupResolverRelativePath,
        balancerTemplateRelativePath,
        balancerDataClientPathname,
        groupMap,
      }),
    ])
  })

  if (!throwUnhandled) return promise
  return promise.catch((e) => {
    setTimeout(() => {
      throw e
    })
  })
}

const generateEntryPointsFolders = async ({
  cancellationToken,
  projectPathname,
  bundleIntoRelativePath,
  importMapRelativePath,
  inlineSpecifierMap,
  nativeModulePredicate,
  entryPointMap,
  babelPluginMap,
  minify,
  logLevel,
  writeOnFileSystem,
  format,
  formatOutputOptions,
  groupMap,
}) => {
  await Promise.all(
    Object.keys(groupMap).map((compileId) => {
      return bundleWithRollup({
        cancellationToken,
        writeOnFileSystem,
        ...computeRollupOptionsWithBalancing({
          cancellationToken,
          projectPathname,
          bundleIntoRelativePath,
          importMapRelativePath,
          inlineSpecifierMap,
          nativeModulePredicate,
          entryPointMap,
          babelPluginMap,
          minify,
          logLevel,
          format,
          formatOutputOptions,
          groupMap,
          compileId,
        }),
      })
    }),
  )
}

const generateEntryPointsBalancerFiles = ({
  cancellationToken,
  projectPathname,
  bundleIntoRelativePath,
  importMapRelativePath,
  nativeModulePredicate,
  entryPointMap,
  babelPluginMap,
  minify,
  logLevel,
  writeOnFileSystem,
  format,
  balancerTemplateRelativePath,
  balancerDataClientPathname,
  platformGroupResolverRelativePath,
  groupMap,
}) => {
  return Promise.all(
    Object.keys(entryPointMap).map((entryPointName) => {
      return Promise.all([
        bundleWithRollup({
          cancellationToken,
          writeOnFileSystem,
          ...computeRollupOptionsForBalancer({
            cancellationToken,
            projectPathname,
            bundleIntoRelativePath,
            importMapRelativePath,
            nativeModulePredicate,
            babelPluginMap,
            entryPointName,
            minify,
            logLevel,
            format,
            balancerTemplateRelativePath,
            balancerDataClientPathname,
            platformGroupResolverRelativePath,
            groupMap,
          }),
        }),
      ])
    }),
  )
}
