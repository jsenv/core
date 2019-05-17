import { extname, dirname, basename } from "path"
import { getOrGenerateCompiledFile } from "../compiled-file-service/get-or-generate-compiled-file.js"
import { bundleNode } from "../bundle/node/bundleNode.js"
import { platformClientBundleToCompilationResult } from "./platformClientBundleToCompilationResult.js"
import { pathnameToOperatingSystemPath } from "../operating-system-path.js"

export const generateNodeBundle = async ({
  projectPathname,
  compileIntoRelativePath,
  importMapRelativePath,
  sourceRelativePath,
  compileRelativePath,
  sourcemapRelativePath = computeSourcemapRelativePath(compileRelativePath),
  inlineSpecifierMap = {},
  babelConfigMap,
  logLevel = "off",
}) => {
  return getOrGenerateCompiledFile({
    projectPathname,
    sourceRelativePath,
    compileRelativePath: `${compileIntoRelativePath}${compileRelativePath}`,
    compile: async () => {
      const entryExtname = extname(compileRelativePath)
      const entryBasename = basename(compileRelativePath, entryExtname)
      const entryDirname = dirname(compileRelativePath)
      const entryName = entryBasename

      if (entryDirname) {
        compileIntoRelativePath = `${compileIntoRelativePath}/${entryDirname}`
      }

      const entryPointMap = {
        [entryName]: sourceRelativePath,
      }

      const bundle = await bundleNode({
        projectFolder: pathnameToOperatingSystemPath(projectPathname),
        bundleIntoRelativePath: compileIntoRelativePath,
        importMapRelativePath,
        entryPointMap,
        inlineSpecifierMap,
        babelConfigMap,
        compileGroupCount: 1,
        throwUnhandled: false,
        writeOnFileSystem: false,
        logLevel,
      })

      return platformClientBundleToCompilationResult({
        projectPathname,
        compileIntoRelativePath,
        compileRelativePath,
        sourcemapRelativePath,
        inlineSpecifierMap,
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
