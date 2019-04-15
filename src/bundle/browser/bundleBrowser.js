import { normalizePathname } from "/node_modules/@jsenv/module-resolution/index.js"
import { browserScoreMap } from "../../group-map/index.js"
import { bundlePlatform } from "../bundlePlatform.js"
import { computeRollupOptionsWithoutBalancing } from "./computeRollupOptionsWithoutBalancing.js"
import { computeRollupOptionsWithBalancing } from "./computeRollupOptionsWithBalancing.js"
import { computeRollupOptionsForBalancer } from "./computeRollupOptionsForBalancer.js"
import { generateEntryPointMapPages } from "./generateEntryPointMapPages.js"
import {
  BUNDLE_BROWSER_DEFAULT_IMPORT_MAP_FILENAME_RELATIVE,
  BUNDLE_BROWSER_DEFAULT_BUNDLE_INTO,
  BUNDLE_BROWSER_DEFAULT_ENTRY_POINT_MAP,
  BUNDLE_BROWSER_DEFAULT_BABEL_CONFIG_MAP,
} from "./bundle-browser-constant.js"

export const bundleBrowser = async ({
  projectFolder,
  babelConfigMap = BUNDLE_BROWSER_DEFAULT_BABEL_CONFIG_MAP,
  importMapFilenameRelative = BUNDLE_BROWSER_DEFAULT_IMPORT_MAP_FILENAME_RELATIVE,
  into = BUNDLE_BROWSER_DEFAULT_BUNDLE_INTO,
  entryPointMap = BUNDLE_BROWSER_DEFAULT_ENTRY_POINT_MAP,
  compileGroupCount = 1,
  platformScoreMap = browserScoreMap,
  verbose,
  minify = true,
  generateEntryPages = false,
  throwUnhandled = true,
  logBundleFilePaths = true,
}) => {
  projectFolder = normalizePathname(projectFolder)
  const promise = Promise.all([
    bundlePlatform({
      entryPointMap,
      projectFolder,
      into,
      babelConfigMap,
      compileGroupCount,
      platformScoreMap,
      verbose,
      logBundleFilePaths,
      computeRollupOptionsWithoutBalancing: (context) =>
        computeRollupOptionsWithoutBalancing({
          importMapFilenameRelative,
          projectFolder,
          into,
          entryPointMap,
          babelConfigMap,
          minify,
          ...context,
        }),
      computeRollupOptionsWithBalancing: (context) =>
        computeRollupOptionsWithBalancing({
          importMapFilenameRelative,
          projectFolder,
          into,
          entryPointMap,
          babelConfigMap,
          minify,
          ...context,
        }),
      computeRollupOptionsForBalancer: (context) =>
        computeRollupOptionsForBalancer({
          projectFolder,
          into,
          babelConfigMap,
          minify,
          ...context,
        }),
    }),
    generateEntryPages
      ? generateEntryPointMapPages({
          projectFolder,
          into,
          entryPointMap,
        })
      : null,
  ])
  if (!throwUnhandled) return promise
  return promise.catch((e) => {
    setTimeout(() => {
      throw e
    })
  })
}
