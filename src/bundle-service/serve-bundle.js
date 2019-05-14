import { extname, dirname, basename } from "path"
import { bundleBrowser } from "../bundle/browser/bundleBrowser.js"
import { bundleNode } from "../bundle/node/bundleNode.js"
import { serveCompiledFile } from "../compiled-file-service/index.js"
import { platformClientBundleToCompilationResult } from "./platformClientBundleToCompilationResult.js"

export const serveBundle = async ({
  projectFolder,
  importMapFilenameRelative,
  compileInto,
  babelConfigMap,
  filenameRelative,
  sourceFilenameRelative,
  headers,
  sourcemapFilenameRelative = computeSourcemapFilenameRelative(filenameRelative),
  inlineSpecifierMap = {},
  format = "system",
}) => {
  return serveCompiledFile({
    projectFolder,
    headers,
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

      const generateBundle = format === "cjs" ? bundleNode : bundleBrowser

      const bundle = await generateBundle({
        projectFolder,
        importMapFilenameRelative,
        into: compileInto,
        entryPointMap,
        inlineSpecifierMap,
        babelConfigMap,
        format,
        compileGroupCount: 1,
        throwUnhandled: false,
        writeOnFileSystem: false,
        logLevel: "off",
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
  })
}

const computeSourcemapFilenameRelative = (filenameRelative) => {
  const entryBasename = basename(filenameRelative)
  const sourcemapFilenameRelative = `${entryBasename}__asset__/${entryBasename}.map`
  return sourcemapFilenameRelative
}
