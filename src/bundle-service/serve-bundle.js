import { extname, dirname, basename } from "path"
import { bundleBrowser } from "../bundle/browser/bundleBrowser.js"
import { serveCompiledFile } from "../server-compile/serve-compiled-file/index.js"
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

      const bundle = await bundleBrowser({
        projectFolder,
        importMapFilenameRelative,
        into: compileInto,
        entryPointMap,
        inlineSpecifierMap,
        babelConfigMap,
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
