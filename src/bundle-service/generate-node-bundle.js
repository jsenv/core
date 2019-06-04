import { extname, dirname, basename } from "path"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { getOrGenerateCompiledFile } from "../compiled-file-service/get-or-generate-compiled-file.js"
import { generateCommonJsBundle } from "../bundling/commonjs/generate-commonjs-bundle.js"
import { platformClientBundleToCompilationResult } from "./platformClientBundleToCompilationResult.js"
import { LOG_LEVEL_OFF } from "../logger.js"

export const generateNodeBundle = async ({
  projectPathname,
  compileIntoRelativePath,
  importMapRelativePath,
  sourceRelativePath,
  compileRelativePath,
  sourcemapRelativePath = computeSourcemapRelativePath(compileRelativePath),
  inlineSpecifierMap = {},
  babelPluginMap,
  logLevel = LOG_LEVEL_OFF,
}) => {
  return getOrGenerateCompiledFile({
    projectPathname,
    sourceRelativePath,
    compileRelativePath: `${compileIntoRelativePath}${compileRelativePath}`,
    compile: async () => {
      const entryExtname = extname(sourceRelativePath)
      const entryBasename = basename(sourceRelativePath, entryExtname)
      const entryDirname = dirname(sourceRelativePath)
      const entryName = entryBasename
      const bundleIntoRelativePath = entryDirname
        ? `${compileIntoRelativePath}${entryDirname}`
        : compileIntoRelativePath
      const entryPointMap = {
        [entryName]: sourceRelativePath,
      }

      const bundle = await generateCommonJsBundle({
        projectPath: pathnameToOperatingSystemPath(projectPathname),
        bundleIntoRelativePath,
        importMapRelativePath,
        entryPointMap,
        inlineSpecifierMap,
        babelPluginMap,
        compileGroupCount: 1,
        throwUnhandled: false,
        writeOnFileSystem: false,
        logLevel,
      })

      return platformClientBundleToCompilationResult({
        projectPathname,
        compileIntoRelativePath,
        inlineSpecifierMap,
        entryRelativePath: sourceRelativePath,
        sourcemapRelativePath,
        bundle,
      })
    },
    ifEtagMatch: null,
    ifModifiedSinceDate: null,
    cacheIgnored: false,
    cacheHitTracking: false,
    cacheInterProcessLocking: false,
  })
}

const computeSourcemapRelativePath = (compileRelativePath) => {
  const entryBasename = basename(compileRelativePath)
  const sourcemapRelativePath = `/${entryBasename}__asset__/${entryBasename}.map`
  return sourcemapRelativePath
}
