import { resolve } from "path"
import { existsSync } from "fs"
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

      const browserGroupResolverFilename = `${projectFolder}/${browserGroupResolverFilenameRelativeInception}`

      const inlineSpecifierMap = {
        ["BROWSER_CLIENT_DATA.js"]: () => generateBrowserClientDataSource({ importMap, groupMap }),
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
        logBundleFilePaths: false,
      })
      const main = bundle.output[0]
      const sources = main.map.sources.map((sourceRelativeToCompileInto) => {
        const sourceFilename = resolve(
          `${projectFolder}/${compileInto}`,
          sourceRelativeToCompileInto,
        )
        const sourceRelativeToProjectFolder = sourceFilename.slice(`${projectFolder}/`.length)
        return sourceRelativeToProjectFolder
      })
      const sourcesContent = main.map.sourcesContent.slice()

      // BROWSER_CLIENT_DATA.js has no location on filesystem
      // it means cache validation would fail saying file does not exists
      // and would not be invalidated if something required by BROWSER_CLIENT_DATA.js
      // has changed.
      // BROWSER_CLIENT_DATA.js is generated thanks to importMapFilenameRelative
      // so we replace it with that file.
      const browserClientDataIndex = sources.indexOf("BROWSER_CLIENT_DATA.js")
      if (existsSync(`${projectFolder}/${importMapFilenameRelative}`)) {
        sources[browserClientDataIndex] = importMapFilenameRelative
      } else {
        sources.splice(browserClientDataIndex, 1)
      }

      return {
        contentType: "application/javascript",
        compiledSource: main.code,
        sources,
        sourcesContent,
        assets: ["main.map.js"],
        assetsContent: [JSON.stringify(main.map)],
        writeCompiledSourceFile: false, // already written by rollup
        writeAssetsFile: false, // already written by rollup
      }
    },
  })
}

const generateBrowserClientDataSource = ({
  importMap,
  groupMap,
}) => `export const importMap = ${uneval(importMap)}
export const groupMap = ${uneval(groupMap)}`
