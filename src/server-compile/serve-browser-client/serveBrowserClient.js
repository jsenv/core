import { uneval } from "@dmail/uneval"
import { readProjectImportMap } from "../../import-map/readProjectImportMap.js"
import { filenameRelativeInception } from "../../filenameRelativeInception.js"
import { bundleBrowser } from "../../bundle/browser/bundleBrowser.js"
import { serveCompiledFile } from "../serve-compiled-file/index.js"

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

  return serveCompiledFile({
    projectFolder,
    headers,
    sourceFilenameRelative: browserClientFilenameRelativeInception,
    compiledFilenameRelative: `${compileInto}/${browserClientFilenameRelativeInception}`,
    compile: async () => {
      const importMap = readProjectImportMap({
        projectFolder,
        importMapFilenameRelative,
      })

      const entryPointMap = {
        browserClient: browserClientFilenameRelativeInception,
      }

      const browserGroupResolverFilenameRelativeInception = filenameRelativeInception({
        projectFolder,
        filenameRelative: browserGroupResolverFilenameRelative,
      })

      const inlineSpecifierMap = {
        ["BROWSER_CLIENT_DATA.js"]: () => generateBrowserClientDataSource({ importMap, groupMap }),
        ["BROWSER_GROUP_RESOLVER.js"]: `${projectFolder}/${browserGroupResolverFilenameRelativeInception}`,
      }

      const bundle = await bundleBrowser({
        projectFolder,
        into: compileInto,
        entryPointMap,
        inlineSpecifierMap,
        babelConfigMap,
        compileGroupCount: 1,
        throwUnhandled: false,
        logBundleFilePaths: false,
      })
      const main = bundle.output[0]
      return {
        contentType: "application/javascript",
        compiledSource: main.code,
        sources: main.map.sources,
        sourcesContent: main.map.sourcesContent,
        assets: ["main.map.js"],
        assetsSource: [JSON.stringify(main.map)],
        writeCompiledSourceFile: false, // already written by rollup
        writeAssetsFile: false, // already written by rollup
      }
    },
    // for now disable cache for client because veryfing
    // it would mean ensuring the whole bundle is still valid
    // I suspect it is faster to regenerate the bundle than check
    // if it's still valid.
    clientCompileCacheStrategy: "none",
  })
}

const generateBrowserClientDataSource = ({
  importMap,
  groupMap,
}) => `export const importMap = ${uneval(importMap)}
export const groupMap = ${uneval(groupMap)}`
