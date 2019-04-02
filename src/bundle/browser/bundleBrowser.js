import { normalizePathname } from "@jsenv/module-resolution"
import { browserScoring } from "../../group-description/index.js"
import { bundlePlatform } from "../bundlePlatform.js"
import { computeRollupOptionsWithoutBalancing } from "./computeRollupOptionsWithoutBalancing.js"
import { computeRollupOptionsWithBalancing } from "./computeRollupOptionsWithBalancing.js"
import { computeRollupOptionsForBalancer } from "./computeRollupOptionsForBalancer.js"
import { generateEntryPointMapPages } from "./generateEntryPointMapPages.js"

export const bundleBrowser = async ({
  projectFolder,
  importMap,
  into,
  globalName,
  globalNameIsPromise = false,
  entryPointMap,
  babelConfigMap,
  compileGroupCount = 1,
  platformScoring = browserScoring,
  verbose,
  minify = true,
  generateEntryPages = false,
}) => {
  projectFolder = normalizePathname(projectFolder)

  if (typeof globalName !== "string")
    throw new TypeError(`globalName must be a string, got ${globalName}.`)

  return await Promise.all([
    bundlePlatform({
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
          globalName,
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
          globalName,
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
          globalName,
          globalNameIsPromise,
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
}
