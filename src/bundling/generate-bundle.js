import { operatingSystemPathToPathname } from "@jsenv/operating-system-path"
import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../cancellationHelper.js"
import { generateGroupMap } from "../group-map/index.js"
import { LOG_LEVEL_ERRORS_WARNINGS_AND_LOGS } from "../logger.js"
import { bundleWithoutBalancing } from "./bundle-without-balancing.js"
import { bundleWithBalancing } from "./bundle-with-balancing.js"
import { bundleBalancer } from "./bundle-balancer.js"
import {
  DEFAULT_IMPORT_MAP_RELATIVE_PATH,
  DEFAULT_GLOBAL_THIS_HELPER_RELATIVE_PATH,
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
  importDefaultExtension,
  globalThisHelperRelativePath = DEFAULT_GLOBAL_THIS_HELPER_RELATIVE_PATH,
  specifierMap,
  dynamicSpecifierMap,
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
  platformAlwaysInsidePlatformScoreMap,
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
      return bundleWithoutBalancing({
        cancellationToken,
        projectPathname,
        bundleIntoRelativePath,
        importMapRelativePath,
        importDefaultExtension,
        globalThisHelperRelativePath,
        specifierMap,
        dynamicSpecifierMap,
        nativeModulePredicate,
        entryPointMap,
        babelPluginMap,
        minify,
        logLevel,
        format,
        formatOutputOptions,
        writeOnFileSystem,
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
      platformAlwaysInsidePlatformScoreMap,
    })

    return await Promise.all([
      generateEntryPointsFolders({
        cancellationToken,
        projectPathname,
        bundleIntoRelativePath,
        importMapRelativePath,
        importDefaultExtension,
        globalThisHelperRelativePath,
        specifierMap,
        dynamicSpecifierMap,
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
        importDefaultExtension,
        globalThisHelperRelativePath,
        specifierMap,
        dynamicSpecifierMap,
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
  importDefaultExtension,
  globalThisHelperRelativePath,
  specifierMap,
  dynamicSpecifierMap,
  nativeModulePredicate,
  entryPointMap,
  babelPluginMap,
  minify,
  logLevel,
  writeOnFileSystem,
  format,
  formatOutputOptions,
  groupMap,
}) =>
  Promise.all(
    Object.keys(groupMap).map(async (compileId) =>
      bundleWithBalancing({
        cancellationToken,
        projectPathname,
        bundleIntoRelativePath,
        importMapRelativePath,
        importDefaultExtension,
        globalThisHelperRelativePath,
        specifierMap,
        dynamicSpecifierMap,
        nativeModulePredicate,
        entryPointMap,
        babelPluginMap,
        minify,
        logLevel,
        format,
        formatOutputOptions,
        groupMap,
        compileId,
        writeOnFileSystem,
      }),
    ),
  )

const generateEntryPointsBalancerFiles = ({
  cancellationToken,
  projectPathname,
  bundleIntoRelativePath,
  importMapRelativePath,
  importDefaultExtension,
  globalThisHelperRelativePath,
  specifierMap,
  dynamicSpecifierMap,
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
}) =>
  Promise.all(
    Object.keys(entryPointMap).map(async (entryPointName) =>
      bundleBalancer({
        cancellationToken,
        projectPathname,
        bundleIntoRelativePath,
        importMapRelativePath,
        importDefaultExtension,
        globalThisHelperRelativePath,
        specifierMap,
        dynamicSpecifierMap,
        nativeModulePredicate,
        entryPointMap: {
          [entryPointName]: balancerTemplateRelativePath,
        },
        babelPluginMap,
        minify,
        logLevel,
        format,
        balancerDataClientPathname,
        platformGroupResolverRelativePath,
        groupMap,
        writeOnFileSystem,
      }),
    ),
  )
