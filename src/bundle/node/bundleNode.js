import { nodeScoring } from "../../group-description/index.js"
import { bundlePlatform } from "../bundlePlatform.js"
import { computeRollupOptionsWithoutBalancing } from "./computeRollupOptionsWithoutBalancing.js"
import { computeRollupOptionsWithBalancing } from "./computeRollupOptionsWithBalancing.js"
import { computeRollupOptionsForBalancer } from "./computeRollupOptionsForBalancer.js"

export const bundleNode = async ({
  importMap,
  projectFolder,
  into,
  entryPointsDescription,
  babelPluginDescription,
  compileGroupCount = 2,
  platformScoring = nodeScoring,
  verbose,
}) => {
  return await bundlePlatform({
    entryPointsDescription,
    projectFolder,
    into,
    babelPluginDescription,
    compileGroupCount,
    platformScoring,
    verbose,
    computeRollupOptionsWithoutBalancing: (context) =>
      computeRollupOptionsWithoutBalancing({
        importMap,
        projectFolder,
        into,
        entryPointsDescription,
        babelPluginDescription,
        ...context,
      }),
    computeRollupOptionsWithBalancing: (context) =>
      computeRollupOptionsWithBalancing({
        importMap,
        projectFolder,
        into,
        entryPointsDescription,
        babelPluginDescription,
        ...context,
      }),
    computeRollupOptionsForBalancer: (context) =>
      computeRollupOptionsForBalancer({
        importMap,
        projectFolder,
        into,
        babelPluginDescription,
        ...context,
      }),
  })
}
