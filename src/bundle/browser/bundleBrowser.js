import { normalizePathname } from "/node_modules/@jsenv/module-resolution/index.js"
import { browserScoreMap } from "../../group-map/index.js"
import { bundlePlatform } from "../bundlePlatform.js"
import { computeRollupOptionsWithoutBalancing } from "./computeRollupOptionsWithoutBalancing.js"
import { computeRollupOptionsWithBalancing } from "./computeRollupOptionsWithBalancing.js"
import { computeRollupOptionsForBalancer } from "./computeRollupOptionsForBalancer.js"
import { generateEntryPointMapPages } from "./generateEntryPointMapPages.js"

export const bundleBrowser = async ({
  projectFolder,
  importMap,
  into,
  entryPointMap,
  babelConfigMap,
  compileGroupCount = 1,
  platformScoreMap = browserScoreMap,
  verbose,
  minify = true,
  generateEntryPages = false,
}) => {
  projectFolder = normalizePathname(projectFolder)
  try {
    return await Promise.all([
      bundlePlatform({
        entryPointMap,
        projectFolder,
        into,
        babelConfigMap,
        compileGroupCount,
        platformScoreMap,
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
      }),
      generateEntryPages
        ? generateEntryPointMapPages({
            projectFolder,
            into,
            entryPointMap,
          })
        : null,
    ])
  } catch (e) {
    process.exitCode = 1
    throw e
  }
}
