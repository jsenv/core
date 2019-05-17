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
  DEFAULT_BABEL_CONFIG_MAP,
} from "./bundle-browser-constant.js"
import { operatingSystemFilenameToPathname } from "/src/operating-system-filename.js"

export const bundleBrowser = async ({
  projectFolder,
  bundleIntoRelativePath = DEFAULT_BUNDLE_INTO_RELATIVE_PATH,
  importMapRelativePath = DEFAULT_IMPORT_MAP_RELATIVE_PATH,
  entryPointMap = DEFAULT_ENTRY_POINT_MAP,
  browserGroupResolverRelativePath = DEFAULT_BROWSER_GROUP_RESOLVER_RELATIVE_PATH,
  inlineSpecifierMap = {},
  babelConfigMap = DEFAULT_BABEL_CONFIG_MAP,
  compileGroupCount = 1,
  platformScoreMap = browserScoreMap,
  format = "system", // or iife
  logLevel = "log",
  minify = false,
  throwUnhandled = true,
  writeOnFileSystem = true,
  generateEntryPages = false,
}) => {
  const projectPathname = operatingSystemFilenameToPathname(projectFolder)

  const bundlePlatformPromise = bundlePlatform({
    projectPathname,
    bundleIntoRelativePath,
    entryPointMap,
    babelConfigMap,
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
        babelConfigMap,
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
        babelConfigMap,
        minify,
        ...context,
      }),
    computeRollupOptionsForBalancer: (context) =>
      computeRollupOptionsForBalancer({
        projectPathname,
        bundleIntoRelativePath,
        importMapRelativePath,
        browserGroupResolverRelativePath,
        babelConfigMap,
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
