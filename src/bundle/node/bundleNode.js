import { operatingSystemFilenameToPathname } from "../../operating-system-filename.js"
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
  DEFAULT_BABEL_CONFIG_MAP,
} from "./bundle-node-constant.js"

export const bundleNode = async ({
  projectFolder,
  bundleIntoRelativePath = DEFAULT_BUNDLE_INTO_RELATIVE_PATH,
  importMapRelativePath = DEFAULT_IMPORT_MAP_RELATIVE_PATH,
  entryPointMap = DEFAULT_ENTRY_POINT_MAP,
  nodeGroupResolverRelativePath = DEFAULT_NODE_GROUP_RESOLVER_RELATIVE_PATH,
  inlineSpecifierMap = {},
  babelConfigMap = DEFAULT_BABEL_CONFIG_MAP,
  compileGroupCount = 1,
  versionScoreMap = nodeVersionScoreMap,
  logLevel = "log",
  minify = false,
  throwUnhandled = true,
  writeOnFileSystem = true,
}) => {
  const projectPathname = operatingSystemFilenameToPathname(projectFolder)

  const promise = bundlePlatform({
    projectPathname,
    bundleIntoRelativePath,
    entryPointMap,
    babelConfigMap,
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
        babelConfigMap,
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
        babelConfigMap,
        minify,
        ...context,
      }),
    computeRollupOptionsForBalancer: (context) =>
      computeRollupOptionsForBalancer({
        projectPathname,
        bundleIntoRelativePath,
        importMapRelativePath,
        nodeGroupResolverRelativePath,
        babelConfigMap,
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
