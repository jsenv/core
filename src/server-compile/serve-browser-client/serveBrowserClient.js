import { dirname, resolve } from "path"
import { existsSync, readFileSync } from "fs"
import { uneval } from "@dmail/uneval"
import { readProjectImportMap } from "../../import-map/readProjectImportMap.js"
import { filenameRelativeInception } from "../../filenameRelativeInception.js"
import { bundleBrowser } from "../../bundle/browser/bundleBrowser.js"
import { serveCompiledFile } from "../serve-compiled-file/index.js"
import { writeOrUpdateSourceMappingURL } from "../../source-mapping-url.js"

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
    compiledFilenameRelative: `${compileInto}/browserClient.js`,
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
        writeOnFileSystem: false,
        logBundleFilePaths: false,
      })
      const main = bundle.output[0]
      const mainSourcemap = main.map
      const sources = mainSourcemap.sources.map((sourceRelativeToEntryDirectory) => {
        const sourceFilename = resolve(
          dirname(`${projectFolder}/${compileInto}/browserClient.js`),
          sourceRelativeToEntryDirectory,
        )
        const sourceRelativeToProjectFolder = sourceFilename.slice(`${projectFolder}/`.length)
        return sourceRelativeToProjectFolder
      })
      const sourcemap = {
        ...mainSourcemap,
        sources: sources.map((source) => `/${source}`),
      }

      const sourcesContent = mainSourcemap.sourcesContent.slice()
      // BROWSER_CLIENT_DATA.js has no location on filesystem
      // it means cache validation would fail saying file does not exists
      // and would not be invalidated if something required by BROWSER_CLIENT_DATA.js
      // has changed.
      // BROWSER_CLIENT_DATA.js is generated thanks to importMapFilenameRelative
      // so we replace it with that file.
      const browserClientDataIndex = sources.indexOf("BROWSER_CLIENT_DATA.js")
      const importMapFilename = `${projectFolder}/${importMapFilenameRelative}`
      if (existsSync(importMapFilename)) {
        sources[browserClientDataIndex] = importMapFilenameRelative
        sourcesContent[browserClientDataIndex] = readFileSync(importMapFilename)
      } else {
        sources.splice(browserClientDataIndex, 1)
      }

      const sourcemapFilenameRelative = "browserClient.js__asset__/browserClient.js.map"
      const compiledSource = writeOrUpdateSourceMappingURL(
        main.code,
        `./${sourcemapFilenameRelative}`,
      )

      return {
        contentType: "application/javascript",
        compiledSource,
        sources,
        sourcesContent,
        assets: [sourcemapFilenameRelative],
        assetsContent: [JSON.stringify(sourcemap, null, "  ")],
      }
    },
  })
}

const generateBrowserClientDataSource = ({
  importMap,
  groupMap,
}) => `export const importMap = ${uneval(importMap)}
export const groupMap = ${uneval(groupMap)}`
