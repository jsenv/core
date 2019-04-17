import { uneval } from "@dmail/uneval"
import { readProjectImportMap } from "../../import-map/readProjectImportMap.js"
import { resolveProjectFilename } from "../../resolveProjectFilename.js"
import { bundleBrowser } from "../../bundle/browser/bundleBrowser.js"
import { serveCompiledFile } from "../serve-compiled-file/index.js"

export const serveBrowserClient = async ({
  projectFolder,
  importMapFilenameRelative,
  compileInto,
  babelConfigMap,
  groupMap,
  headers,
}) => {
  const browserClientSourceFilenameRelative = `node_modules/@jsenv/core/src/browser-client/index.js`
  const browserClientCompiledFilenameRelative = `${compileInto}/${browserClientSourceFilenameRelative}`
  const browserClientSourceFilename = resolveProjectFilename({
    projectFolder,
    filenameRelative: browserClientSourceFilenameRelative,
  })
  const browserGroupResolverFilenameRelative = `node_modules/@jsenv/core/src/browser-group-resolver/index.js`
  const browserGroupResolverFilename = resolveProjectFilename({
    projectFolder,
    filenameRelative: browserGroupResolverFilenameRelative,
  })

  return serveCompiledFile({
    projectFolder,
    headers,
    sourceFilenameRelative: browserClientSourceFilenameRelative,
    compiledFilenameRelative: browserClientCompiledFilenameRelative,
    compile: async () => {
      const importMap = readProjectImportMap({
        projectFolder,
        importMapFilenameRelative,
      })

      const bundle = await bundleBrowser({
        projectFolder,
        into: compileInto,
        entryPointMap: {
          browserClient: "JSENV_BROWSER_CLIENT.js",
        },
        inlineSpecifierMap: {
          ["JSENV_BROWSER_CLIENT.js"]: browserClientSourceFilename,
          ["BROWSER_CLIENT_DATA.js"]: () =>
            generateBrowserClientDataSource({ importMap, groupMap }),
          ["BROWSER_GROUP_RESOLVER.js"]: browserGroupResolverFilename,
        },
        babelConfigMap,
        minify: false,
        throwUnhandled: false,
        compileGroupCount: 1,
        verbose: true,
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
