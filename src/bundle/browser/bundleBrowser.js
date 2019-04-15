import { normalizePathname } from "/node_modules/@jsenv/module-resolution/index.js"
import { browserScoreMap } from "../../group-map/index.js"
import { bundlePlatform } from "../bundlePlatform.js"
import { computeRollupOptionsWithoutBalancing } from "./computeRollupOptionsWithoutBalancing.js"
import { computeRollupOptionsWithBalancing } from "./computeRollupOptionsWithBalancing.js"
import { computeRollupOptionsForBalancer } from "./computeRollupOptionsForBalancer.js"
import { generateEntryPointMapPages } from "./generateEntryPointMapPages.js"

export const bundleBrowser = async ({
  projectFolder,
  importMapFilenameRelative,
  into,
  entryPointMap,
  babelConfigMap,
  compileGroupCount = 1,
  platformScoreMap = browserScoreMap,
  verbose,
  minify = true,
  generateEntryPages = false,
  trowUnhandled = true,
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
  if (!trowUnhandled) return promise
  return promise.catch((e) => {
    setTimeout(() => {
      throw e
    })
  })
}
