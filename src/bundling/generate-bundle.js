import { operatingSystemPathToPathname } from "@jsenv/operating-system-path"
import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../cancellationHelper.js"
import { generateGroupMap } from "../group-map/index.js"
import { LOG_LEVEL_ERRORS_WARNINGS_AND_LOGS } from "../logger.js"
import { relativePathInception } from "../JSENV_PATH.js"
import { bundleWithoutBalancing } from "./bundle-without-balancing.js"
import { bundleWithBalancing } from "./bundle-with-balancing.js"
import { bundleBalancer } from "./bundle-balancer.js"
import {
  DEFAULT_PLATFORM_GROUP_RESOLVER_RELATIVE_PATH,
  DEFAULT_ENTRY_POINT_MAP,
  DEFAULT_NATIVE_MODULE_PREDICATE,
  DEFAULT_BABEL_PLUGIN_MAP,
  DEFAULT_PLATFORM_SCORE_MAP,
} from "./generate-bundle-constant.js"

export const generateBundle = ({
  projectPath,
  bundleIntoRelativePath,
  importDefaultExtension,
  importMap,
  specifierMap,
  specifierDynamicMap,
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
        importDefaultExtension,
        importMap,
        specifierMap,
        specifierDynamicMap,
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
      throw createFormatIncompatibleWithBalancingError({ format })
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
        importDefaultExtension,
        importMap,
        specifierMap,
        specifierDynamicMap,
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
        importDefaultExtension,
        importMap,
        specifierMap,
        specifierDynamicMap,
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
  importDefaultExtension,
  importMap,
  specifierMap,
  specifierDynamicMap,
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
        importDefaultExtension,
        importMap,
        specifierMap,
        specifierDynamicMap,
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
  importDefaultExtension,
  importMap,
  specifierMap,
  specifierDynamicMap,
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
        importDefaultExtension,
        importMap,
        specifierMap,
        specifierDynamicMap,
        nativeModulePredicate,
        entryPointMap: {
          [entryPointName]: relativePathInception({
            projectPathname,
            importMap,
            relativePath: balancerTemplateRelativePath,
          }),
        },
        babelPluginMap,
        minify,
        logLevel,
        format,
        balancerDataClientPathname,
        platformGroupResolverRelativePath: relativePathInception({
          projectPathname,
          importMap,
          relativePath: platformGroupResolverRelativePath,
        }),
        groupMap,
        writeOnFileSystem,
      }),
    ),
  )

const createFormatIncompatibleWithBalancingError = ({ format }) =>
  new Error(`format not compatible with balancing.
format: ${format}`)
