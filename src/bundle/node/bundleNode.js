import { operatingSystemPathToPathname } from "../../operating-system-path.js"
import { nodeVersionScoreMap } from "../../group-map/index.js"
import { bundlePlatform } from "../bundlePlatform.js"
import { computeRollupOptionsWithoutBalancing } from "./computeRollupOptionsWithoutBalancing.js"
import { computeRollupOptionsWithBalancing } from "./computeRollupOptionsWithBalancing.js"
import { computeRollupOptionsForBalancer } from "./computeRollupOptionsForBalancer.js"
import {
  DEFAULT_BUNDLE_INTO_RELATIVE_PATH,
  DEFAULT_IMPORT_MAP_RELATIVE_PATH,
  DEFAULT_ENTRY_POINT_MAP,
  DEFAULT_NODE_GROUP_RESOLVER_RELATIVE_PATH,
  DEFAULT_BABEL_PLUGIN_MAP,
} from "./bundle-node-constant.js"
import { LOG_LEVEL_ERRORS_WARNINGS_AND_LOGS } from "../../logger.js"

export const bundleNode = async ({
  projectFolder,
  bundleIntoRelativePath = DEFAULT_BUNDLE_INTO_RELATIVE_PATH,
  importMapRelativePath = DEFAULT_IMPORT_MAP_RELATIVE_PATH,
  entryPointMap = DEFAULT_ENTRY_POINT_MAP,
  nodeGroupResolverRelativePath = DEFAULT_NODE_GROUP_RESOLVER_RELATIVE_PATH,
  inlineSpecifierMap = {},
  babelPluginMap = DEFAULT_BABEL_PLUGIN_MAP,
  compileGroupCount = 1,
  versionScoreMap = nodeVersionScoreMap,
  logLevel = LOG_LEVEL_ERRORS_WARNINGS_AND_LOGS,
  minify = false,
  throwUnhandled = true,
  writeOnFileSystem = true,
}) => {
  const projectPathname = operatingSystemPathToPathname(projectFolder)

  const promise = bundlePlatform({
    projectPathname,
    bundleIntoRelativePath,
    entryPointMap,
    babelPluginMap,
    compileGroupCount,
    platformScoreMap: { node: versionScoreMap },
    logLevel,
    writeOnFileSystem,
    computeRollupOptionsWithoutBalancing: (context) =>
      computeRollupOptionsWithoutBalancing({
        projectPathname,
        bundleIntoRelativePath,
        importMapRelativePath,
        inlineSpecifierMap,
        entryPointMap,
        babelPluginMap,
        minify,
        ...context,
      }),
    computeRollupOptionsWithBalancing: (context) =>
      computeRollupOptionsWithBalancing({
        projectPathname,
        bundleIntoRelativePath,
        importMapRelativePath,
        inlineSpecifierMap,
        entryPointMap,
        babelPluginMap,
        minify,
        ...context,
      }),
    computeRollupOptionsForBalancer: (context) =>
      computeRollupOptionsForBalancer({
        projectPathname,
        bundleIntoRelativePath,
        importMapRelativePath,
        nodeGroupResolverRelativePath,
        babelPluginMap,
        minify,
        ...context,
      }),
  })
  if (!throwUnhandled) return promise
  return promise.catch((e) => {
    setTimeout(() => {
      throw e
    })
  })
}
