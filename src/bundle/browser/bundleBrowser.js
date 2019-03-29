import { normalizePathname } from "@jsenv/module-resolution"
import { browserScoring } from "../../group-description/index.js"
import { bundlePlatform } from "../bundlePlatform.js"
import { computeRollupOptionsWithoutBalancing } from "./computeRollupOptionsWithoutBalancing.js"
import { computeRollupOptionsWithBalancing } from "./computeRollupOptionsWithBalancing.js"
import { computeRollupOptionsForBalancer } from "./computeRollupOptionsForBalancer.js"
import { generateBalancerPages } from "./generateBalancerPages.js"

export const bundleBrowser = async ({
  projectFolder,
  importMap,
  into,
  globalName,
  globalNameIsPromise = false,
  entryPointsDescription,
  babelPluginDescription,
  compileGroupCount = 1,
  platformScoring = browserScoring,
  verbose,
  minify = true,
}) => {
  projectFolder = normalizePathname(projectFolder)

  if (typeof globalName !== "string")
    throw new TypeError(`globalName must be a string, got ${globalName}.`)

  return await Promise.all([
    bundlePlatform({
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
          globalName,
          entryPointsDescription,
          babelPluginDescription,
          minify,
          ...context,
        }),
      computeRollupOptionsWithBalancing: (context) =>
        computeRollupOptionsWithBalancing({
          importMap,
          projectFolder,
          into,
          globalName,
          entryPointsDescription,
          babelPluginDescription,
          minify,
          ...context,
        }),
      computeRollupOptionsForBalancer: (context) =>
        computeRollupOptionsForBalancer({
          importMap,
          projectFolder,
          into,
          globalName,
          globalNameIsPromise,
          babelPluginDescription,
          minify,
          ...context,
        }),
    }),
    generateBalancerPages({
      projectFolder,
      into,
      entryPointsDescription,
    }),
  ])
}
