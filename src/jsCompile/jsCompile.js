import path from "path"
import { transpiler } from "./transpiler.js"

export const jsCompile = async ({
  input,
  filename,
  filenameRelative,
  projectFolder,
  inputAst,
  inputMap,
  babelPluginDescription = {},
  remap = true,
  remapMethod = "comment", // 'comment', 'inline'
}) => {
  const sources = []
  const sourcesContent = []
  const assets = []
  const assetsContent = []

  // source can be fetched at `${compileServer.origin}/src/file.js`
  const sourceToSourceForSourceMap = (source) => `/${source}`

  const { map, code, metadata } = await transpiler({
    input,
    filename,
    filenameRelative,
    projectFolder,
    inputAst,
    inputMap,
    babelPluginDescription,
    remap,
  })
  const coverage = metadata.coverage
  let output = code

  if (remap) {
    // we don't need sourceRoot because our path are relative or absolute to the current location
    // we could comment this line because it is not set by babel because not passed during transform
    delete map.sourceRoot

    sources.push(...map.sources)
    sourcesContent.push(...map.sourcesContent)
    map.sources = map.sources.map((source) => sourceToSourceForSourceMap(source))
    // removing sourcesContent from map decrease the sourceMap
    // it also means client have to fetch source from server (additional http request)
    // some client ignore sourcesContent property such as vscode-chrome-debugger
    // Because it's the most complex scenario and we want to ensure client is always able
    // to find source from the sourcemap, we explicitely delete nmap.sourcesContent to test this.
    delete map.sourcesContent

    if (remapMethod === "inline") {
      const mapAsBase64 = new Buffer(JSON.stringify(map)).toString("base64")
      output = writeSourceMapLocation({
        source: output,
        location: `data:application/json;charset=utf-8;base64,${mapAsBase64}`,
      })
    } else if (remapMethod === "comment") {
      // sourceMap will be named file.js.map
      const sourceMapName = `${path.basename(filenameRelative)}.map`
      // it will be located at `${compileServer.origin}/.dist/src/file.js/e3uiyi456&/file.js.map`
      // const folder = path.dirname(file)
      // const folderWithSepOrNothing = folder ? `${folder}/` : ""
      const sourceMapLocationForSource = `./${path.basename(
        filenameRelative,
      )}__asset__/${sourceMapName}`

      output = writeSourceMapLocation({
        source: output,
        location: sourceMapLocationForSource,
      })
      assets.push(sourceMapName)
      assetsContent.push(stringifyMap(map))
    }
  } else {
    sources.push(filenameRelative)
    sourcesContent.push(input)
  }

  if (coverage) {
    assets.push("coverage.json")
    assetsContent.push(stringifyCoverage(coverage))
  }

  return {
    sources,
    sourcesContent,
    assets,
    assetsContent,
    output,
  }
}

const writeSourceMapLocation = ({ source, location }) => {
  return `${source}
${"//#"} sourceMappingURL=${location}`
}

const stringifyMap = (object) => JSON.stringify(object, null, "  ")

const stringifyCoverage = (object) => JSON.stringify(object, null, "  ")

export const getBrowserPlatformFile = () => {
  return "node_modules/dev-server/src/platform/browser/index.js"
}
