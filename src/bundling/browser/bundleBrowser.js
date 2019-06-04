import { operatingSystemPathToPathname } from "@jsenv/operating-system-path"
import { browserScoreMap } from "../../group-map/index.js"
import { bundlePlatform } from "../bundlePlatform.js"
import { computeRollupOptionsWithoutBalancing } from "./computeRollupOptionsWithoutBalancing.js"
import { computeRollupOptionsWithBalancing } from "./computeRollupOptionsWithBalancing.js"
import { computeRollupOptionsForBalancer } from "./computeRollupOptionsForBalancer.js"
import { generateEntryPointMapPages } from "./generateEntryPointMapPages.js"
import {
  DEFAULT_BUNDLE_INTO_RELATIVE_PATH,
  DEFAULT_IMPORT_MAP_RELATIVE_PATH,
  DEFAULT_ENTRY_POINT_MAP,
  DEFAULT_BROWSER_GROUP_RESOLVER_RELATIVE_PATH,
  DEFAULT_BABEL_PLUGIN_MAP,
} from "./bundle-browser-constant.js"
import { LOG_LEVEL_ERRORS_WARNINGS_AND_LOGS } from "../../logger.js"

export const bundleBrowser = async ({
  projectPath,
  bundleIntoRelativePath = DEFAULT_BUNDLE_INTO_RELATIVE_PATH,
  importMapRelativePath = DEFAULT_IMPORT_MAP_RELATIVE_PATH,
  entryPointMap = DEFAULT_ENTRY_POINT_MAP,
  browserGroupResolverRelativePath = DEFAULT_BROWSER_GROUP_RESOLVER_RELATIVE_PATH,
  inlineSpecifierMap = {},
  babelPluginMap = DEFAULT_BABEL_PLUGIN_MAP,
  compileGroupCount = 1,
  platformScoreMap = browserScoreMap,
  format = "system", // or iife
  logLevel = LOG_LEVEL_ERRORS_WARNINGS_AND_LOGS,
  minify = false,
  throwUnhandled = true,
  writeOnFileSystem = true,
  generateEntryPages = false,
}) => {
  const projectPathname = operatingSystemPathToPathname(projectPath)

  const bundlePlatformPromise = bundlePlatform({
    projectPathname,
    bundleIntoRelativePath,
    entryPointMap,
    babelPluginMap,
    compileGroupCount,
    platformScoreMap,
    logLevel,
    writeOnFileSystem,
    computeRollupOptionsWithoutBalancing: (context) =>
      computeRollupOptionsWithoutBalancing({
        projectPathname,
        bundleIntoRelativePath,
        entryPointMap,
        importMapRelativePath,
        inlineSpecifierMap,
        babelPluginMap,
        format,
        minify,
        ...context,
      }),
    computeRollupOptionsWithBalancing: (context) =>
      computeRollupOptionsWithBalancing({
        projectPathname,
        bundleIntoRelativePath,
        entryPointMap,
        importMapRelativePath,
        inlineSpecifierMap,
        babelPluginMap,
        minify,
        ...context,
      }),
    computeRollupOptionsForBalancer: (context) =>
      computeRollupOptionsForBalancer({
        projectPathname,
        bundleIntoRelativePath,
        importMapRelativePath,
        browserGroupResolverRelativePath,
        babelPluginMap,
        minify,
        ...context,
      }),
  })

  const promise = generateEntryPages
    ? Promise.all([
        bundlePlatformPromise,
        generateEntryPointMapPages({
          projectPathname,
          bundleIntoRelativePath,
          entryPointMap,
        }),
      ])
    : bundlePlatformPromise

  if (!throwUnhandled) return promise
  return promise.catch((e) => {
    setTimeout(() => {
      throw e
    })
  })
}
