import { normalizePathname } from "@jsenv/module-resolution"
import { nodeScoring } from "../../group-description/index.js"
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
  platformScoring = nodeScoring,
  verbose,
  minify = false,
}) => {
  projectFolder = normalizePathname(projectFolder)
  return await bundlePlatform({
    entryPointMap,
    projectFolder,
    into,
    babelConfigMap,
    compileGroupCount,
    platformScoring,
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
}
