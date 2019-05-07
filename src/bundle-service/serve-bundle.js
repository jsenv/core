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
  inlineSpecifierMap,
  headers,
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
      const entryName = `${entryDirname ? `${entryDirname}/` : ""}${entryBasename}`

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
        logBundleFilePaths: false,
      })

      return platformClientBundleToCompilationResult({
        projectFolder,
        compileInto,
        filenameRelative,
        inlineSpecifierMap,
        bundle,
      })
    },
  })
}
