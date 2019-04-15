import { normalizePathname } from "/node_modules/@jsenv/module-resolution/index.js"
import { nodeVersionScoreMap } from "../../group-map/index.js"
import { bundlePlatform } from "../bundlePlatform.js"
import { computeRollupOptionsWithoutBalancing } from "./computeRollupOptionsWithoutBalancing.js"
import { computeRollupOptionsWithBalancing } from "./computeRollupOptionsWithBalancing.js"
import { computeRollupOptionsForBalancer } from "./computeRollupOptionsForBalancer.js"

export const bundleNode = async ({
  importMapFilenameRelative,
  projectFolder,
  into,
  entryPointMap,
  babelConfigMap,
  compileGroupCount = 2,
  versionScoreMap = nodeVersionScoreMap,
  verbose,
  minify = false,
  throwUnhandled = true,
  logBundleFilePaths = true,
}) => {
  projectFolder = normalizePathname(projectFolder)
  const promise = bundlePlatform({
    entryPointMap,
    projectFolder,
    into,
    babelConfigMap,
    compileGroupCount,
    platformScoreMap: { node: versionScoreMap },
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
  })
  if (!throwUnhandled) return promise
  return promise.catch((e) => {
    setTimeout(() => {
      throw e
    })
  })
}
