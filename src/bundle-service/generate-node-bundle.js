import { extname, dirname, basename } from "path"
import { getOrGenerateCompiledFile } from "../compiled-file-service/get-or-generate-compiled-file.js"
import { bundleNode } from "../bundle/node/bundleNode.js"
import { platformClientBundleToCompilationResult } from "./platformClientBundleToCompilationResult.js"

export const generateNodeBundle = async ({
  projectFolder,
  importMapFilenameRelative,
  compileInto,
  babelConfigMap,
  filenameRelative,
  sourceFilenameRelative,
  inlineSpecifierMap = {},
  sourcemapFilenameRelative = computeSourcemapFilenameRelative(filenameRelative),
  logLevel = "off",
}) => {
  return getOrGenerateCompiledFile({
    projectFolder,
    sourceFilenameRelative,
    compiledFilenameRelative: `${compileInto}/${filenameRelative}`,
    compile: async () => {
      const entryExtname = extname(filenameRelative)
      const entryBasename = basename(filenameRelative, entryExtname)
      const entryDirname = dirname(filenameRelative)
      const entryName = entryBasename

      if (entryDirname) {
        compileInto = `${compileInto}/${entryDirname}`
      }

      const entryPointMap = {
        [entryName]: sourceFilenameRelative,
      }

      const bundle = await bundleNode({
        projectFolder,
        importMapFilenameRelative,
        into: compileInto,
        entryPointMap,
        inlineSpecifierMap,
        babelConfigMap,
        compileGroupCount: 1,
        throwUnhandled: false,
        writeOnFileSystem: false,
        logLevel,
      })

      return platformClientBundleToCompilationResult({
        projectFolder,
        compileInto,
        filenameRelative,
        sourcemapFilenameRelative,
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

const computeSourcemapFilenameRelative = (filenameRelative) => {
  const entryBasename = basename(filenameRelative)
  const sourcemapFilenameRelative = `${entryBasename}__asset__/${entryBasename}.map`
  return sourcemapFilenameRelative
}
