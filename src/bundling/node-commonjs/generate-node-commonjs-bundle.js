import { extname, dirname, basename } from "path"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { getOrGenerateCompiledFile } from "../../compiled-file-service/get-or-generate-compiled-file.js"
import { nodeVersionScoreMap } from "../../group-map/index.js"
import { generateCommonJsBundle } from "../commonjs/generate-commonjs-bundle.js"
import { platformClientBundleToCompilationResult } from "../platformClientBundleToCompilationResult.js"

export const generateNodeCommonJsBundle = async ({
  projectPathname,
  compileIntoRelativePath,
  importMapRelativePath,
  sourceRelativePath,
  compileRelativePath,
  sourcemapRelativePath = computeSourcemapRelativePath(compileRelativePath),
  inlineSpecifierMap = {},
  babelPluginMap,
  logLevel,
  compileGroupCount,
  nodeScoreMap = nodeVersionScoreMap,
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
        throwUnhandled: false,
        writeOnFileSystem: false,
        logLevel,
        compileGroupCount,
        platformScoreMap: {
          node: nodeScoreMap,
        },
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
