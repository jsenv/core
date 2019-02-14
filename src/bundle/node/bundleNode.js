import { nodeScoring } from "../../group-description/index.js"
import { bundlePlatform } from "../bundlePlatform.js"
import { computeRollupOptionsWithoutBalancing } from "./computeRollupOptionsWithoutBalancing.js"
import { computeRollupOptionsWithBalancing } from "./computeRollupOptionsWithBalancing.js"
import { computeRollupOptionsForBalancer } from "./computeRollupOptionsForBalancer.js"

export const bundleNode = async ({
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
        projectFolder,
        into,
        entryPointsDescription,
        babelPluginDescription,
        ...context,
      }),
    computeRollupOptionsWithBalancing: (context) =>
      computeRollupOptionsWithBalancing({
        projectFolder,
        into,
        entryPointsDescription,
        babelPluginDescription,
        ...context,
      }),
    computeRollupOptionsForBalancer: (context) =>
      computeRollupOptionsForBalancer({
        projectFolder,
        into,
        babelPluginDescription,
        ...context,
      }),
  })
}
