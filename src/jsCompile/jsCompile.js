import path from "path"
import { transpiler } from "./transpiler.js"
import { packager } from "./packager.js"

const writeSourceMapLocation = ({ source, location }) => {
  return `${source}
${"//#"} sourceMappingURL=${location}`
}

const stringifyMap = (object) => JSON.stringify(object, null, "  ")

const stringifyCoverage = (object) => JSON.stringify(object, null, "  ")

export const jsCompile = async ({
  file,
  fileAbsolute,
  inputAst,
  input,
  inputMap,

  // transpile = true,
  plugins = [],
  remap = true,
  remapMethod = "comment", // 'comment', 'inline'
}) => {
  // ideally we would fetch browser platform from server
  // to sthing like 'build/compileId/__platform__.js'
  // and here we would dynamically generate a rollup for that compileId
  // could it work if we simply do sthing like
  // if (file === '__platform__.js') returns a rollup output
  // we would have a prob because the source file does not exists
  // I mean there is no file like __platform__.js existing for the project so it
  // would fail to find it for comparing to cache
  // that's why locate must return the right local file for __platform__.js

  if (file === "__platform__.js") {
    const result = await packager({ fileAbsolute, plugins, remap })
    debugger
  }

  const result = await transpiler({
    file,
    fileAbsolute,
    inputAst,
    input,
    inputMap,
    plugins,
    remap,
  })

  const { map, metadata } = result
  let output = result.code
  const sources = [file]
  const sourcesContent = [input]
  const assets = []
  const assetsContent = []

  if (map) {
    // sourceMap will be named file.js.map
    const sourceMapName = `${path.basename(file)}.map`

    // it will be located at `${compileServer.origin}/build/src/file.js/e3uiyi456&/file.js.map`
    const sourceMapLocationForSource = `${path.basename(file)}__meta__/${sourceMapName}`

    // the name of the source is set to src/file.js
    const sourceNameForSourceMap = file

    // source can be fetched at `${compileServer.origin}/src/file.js`
    const sourceToSourceForSourceMap = (source) => `/${source}`

    delete map.sourceRoot
    // we don't need sourceRoot because our path are relative or absolute to the current location
    // we could comment this line because it is not set by babel because not passed during transform

    delete map.sourcesContent
    // removing sourcesContent from map decrease the sourceMap
    // it also means client have to fetch source from server (additional http request)
    // This is the most complex scenario.
    // some client ignroe the sourcesContent property such as vscode-chrome-debugger
    // Because it's the most complex scenario and we want to ensure lcient is always able
    // to find source from the sourcemap, we explicitely delete nmap.sourcesContent

    map.sources = map.sources.map((source) => sourceToSourceForSourceMap(source))
    // the source can be found at sourceLocationForSourceMap

    map.file = sourceNameForSourceMap
    // this file name supposed to appear in dev tools

    if (remapMethod === "inline") {
      const mapAsBase64 = new Buffer(JSON.stringify(map)).toString("base64")
      output = writeSourceMapLocation({
        source: output,
        location: `data:application/json;charset=utf-8;base64,${mapAsBase64}`,
      })
    } else if (remapMethod === "comment") {
      output = writeSourceMapLocation({
        source: output,
        location: sourceMapLocationForSource,
      })
      assets.push(sourceMapName)
      assetsContent.puhs(stringifyMap(map))
    }
  }

  if (metadata.coverage) {
    assets.push("coverage.json")
    assetsContent.push(stringifyCoverage(metadata.coverage))
  }

  return {
    sources,
    sourcesContent,
    assets,
    assetsContent,
    output,
  }
}
