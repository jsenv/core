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
  globalThisHelperRelativePath,
  specifierMap,
  dynamicSpecifierMap,
  sourceRelativePath,
  compileRelativePath,
  sourcemapPath,
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

      const { bundle, relativePathAbstractArray } = await generateCommonJsBundle({
        projectPath: pathnameToOperatingSystemPath(projectPathname),
        bundleIntoRelativePath,
        importMapRelativePath,
        globalThisHelperRelativePath,
        specifierMap,
        dynamicSpecifierMap,
        entryPointMap,
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
        relativePathAbstractArray,
        entryRelativePath: sourceRelativePath,
        sourcemapPath,
        sourcemapAssetPath: computeSourcemapAssetPath(compileRelativePath),
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

const computeSourcemapAssetPath = (compileRelativePath) => {
  const entryBasename = basename(compileRelativePath)
  const sourcemapPath = `./${entryBasename}__asset__/${entryBasename}.map`
  return sourcemapPath
}
