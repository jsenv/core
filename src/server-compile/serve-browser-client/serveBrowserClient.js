import { uneval } from "@dmail/uneval"
import { readProjectImportMap } from "../../import-map/readProjectImportMap.js"
import { filenameRelativeInception } from "../../filenameRelativeInception.js"
import { bundleBrowser } from "../../bundle/browser/bundleBrowser.js"
import { serveCompiledFile } from "../serve-compiled-file/index.js"
import { platformClientBundleToCompilationResult } from "../platformClientBundleToCompilationResult.js"

export const serveBrowserClient = async ({
  projectFolder,
  importMapFilenameRelative,
  browserGroupResolverFilenameRelative,
  compileInto,
  babelConfigMap,
  groupMap,
  headers,
}) => {
  const browserClientFilenameRelative = `node_modules/@jsenv/core/src/browser-client/index.js`
  const browserClientFilenameRelativeInception = filenameRelativeInception({
    projectFolder,
    filenameRelative: browserClientFilenameRelative,
  })

  const platformClientName = "browserClient"
  const platformClientDataSpecifier = "BROWSER_CLIENT_DATA.js"

  return serveCompiledFile({
    projectFolder,
    headers,
    sourceFilenameRelative: browserClientFilenameRelativeInception,
    compiledFilenameRelative: `${compileInto}/${platformClientName}.js`,
    compile: async () => {
      const importMap = readProjectImportMap({
        projectFolder,
        importMapFilenameRelative,
      })

      const entryPointMap = {
        [platformClientName]: browserClientFilenameRelativeInception,
      }

      const browserGroupResolverFilenameRelativeInception = filenameRelativeInception({
        projectFolder,
        filenameRelative: browserGroupResolverFilenameRelative,
      })

      const browserGroupResolverFilename = `${projectFolder}/${browserGroupResolverFilenameRelativeInception}`

      const inlineSpecifierMap = {
        [platformClientDataSpecifier]: () =>
          generateBrowserClientDataSource({ importMap, groupMap }),
        ["BROWSER_GROUP_RESOLVER.js"]: browserGroupResolverFilename,
      }

      const bundle = await bundleBrowser({
        projectFolder,
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
        importMapFilenameRelative,
        compileInto,
        platformClientName,
        platformClientDataSpecifier,
        bundle,
      })
    },
  })
}

const generateBrowserClientDataSource = ({
  importMap,
  groupMap,
}) => `export const importMap = ${uneval(importMap)}
export const groupMap = ${uneval(groupMap)}`
