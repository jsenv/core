import { normalizePathname } from "/node_modules/@jsenv/module-resolution/index.js"
import { nodeVersionScoreMap } from "../../group-map/index.js"
import { bundlePlatform } from "../bundlePlatform.js"
import { computeRollupOptionsWithoutBalancing } from "./computeRollupOptionsWithoutBalancing.js"
import { computeRollupOptionsWithBalancing } from "./computeRollupOptionsWithBalancing.js"
import { computeRollupOptionsForBalancer } from "./computeRollupOptionsForBalancer.js"

export const bundleNode = async ({
  importMap,
  projectFolder,
  into,
  entryPointMap,
  babelConfigMap,
  compileGroupCount = 2,
  versionScoreMap = nodeVersionScoreMap,
  verbose,
  minify = false,
}) => {
  projectFolder = normalizePathname(projectFolder)
  try {
    return await bundlePlatform({
      entryPointMap,
      projectFolder,
      into,
      babelConfigMap,
      compileGroupCount,
      platformScoreMap: { node: versionScoreMap },
      verbose,
      computeRollupOptionsWithoutBalancing: (context) =>
        computeRollupOptionsWithoutBalancing({
          importMap,
          projectFolder,
          into,
          entryPointMap,
          babelConfigMap,
          minify,
          ...context,
        }),
      computeRollupOptionsWithBalancing: (context) =>
        computeRollupOptionsWithBalancing({
          importMap,
          projectFolder,
          into,
          entryPointMap,
          babelConfigMap,
          minify,
          ...context,
        }),
      computeRollupOptionsForBalancer: (context) =>
        computeRollupOptionsForBalancer({
          importMap,
          projectFolder,
          into,
          babelConfigMap,
          minify,
          ...context,
        }),
    })
  } catch (e) {
    process.exitCode = 1
    throw e
  }
}
