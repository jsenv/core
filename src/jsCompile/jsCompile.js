import path from "path"
import { transpiler } from "./transpiler.js"
import { packager } from "./packager.js"
import { arrayWithout } from "../arrayHelper.js"

const selfLocalRoot = path.resolve(__dirname, "../../../")

export const jsCompile = async ({
  localRoot,
  file,
  fileAbsolute,
  inputAst,
  input,
  inputMap,

  // transpile = true,
  pluginMap = {},
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

  let map
  let coverage
  let output

  const sources = []
  const sourcesContent = []
  const assets = []
  const assetsContent = []

  // source can be fetched at `${compileServer.origin}/src/file.js`
  const sourceToSourceForSourceMap = (source) => `/${source}`

  // path is not this one, it should be loadBrowserPlatform.js I guess
  // to remove. this is not here that we should handle
  // thoose files are already compiled, they just have to be served
  // to the client
  // however pluginNames.indexOf("transform-modules-systemjs")
  // can be used to serve either native-importer or system-importer
  if (file === "node_modules/dev-server/src/platform/browser/index.js") {
    const pluginNames = Object.keys(pluginMap)
    let packagerPluginNames

    if (pluginNames.indexOf("transform-modules-systemjs") > -1) {
      // serve the browser platform relying on window.System.import to load file
      packagerPluginNames = arrayWithout(pluginNames, "transform-modules-systemjs")
    } else if (pluginNames.indexOf("transform-modules-commonjs") > -1) {
      throw new Error(`browser not compatible with commonjs modules`)
    } else {
      // serve the browser platform relying on native import() to load file
    }

    const plugins = packagerPluginNames.map((pluginName) => pluginMap[pluginName])

    const result = await packager({
      file,
      fileAbsolute,
      plugins,
      remap,
    })

    map = result.map
    output = result.code

    const selfExecuted = localRoot === selfLocalRoot
    if (selfExecuted === false) {
      if (localRoot.startsWith(selfLocalRoot) === false) {
        throw new Error(`dev-server must be inside ${localRoot}`)
      }
    }
  } else {
    const plugins = Object.keys(pluginMap).map((pluginName) => pluginMap[pluginName])
    const result = await transpiler({
      localRoot,
      file,
      fileAbsolute,
      inputAst,
      input,
      inputMap,
      plugins,
      remap,
    })

    map = result.map
    coverage = result.metadata.coverage
    output = result.code
  }

  // we don't need sourceRoot because our path are relative or absolute to the current location
  // we could comment this line because it is not set by babel because not passed during transform
  delete map.sourceRoot

  sources.push(...map.sources)
  map.sources = map.sources.map((source) => sourceToSourceForSourceMap(source))

  sourcesContent.push(...map.sourcesContent)
  // removing sourcesContent from map decrease the sourceMap
  // it also means client have to fetch source from server (additional http request)
  // some client ignore sourcesContent property such as vscode-chrome-debugger
  // Because it's the most complex scenario and we want to ensure client is always able
  // to find source from the sourcemap, we explicitely delete nmap.sourcesContent to test this.
  delete map.sourcesContent

  if (remap) {
    if (remapMethod === "inline") {
      const mapAsBase64 = new Buffer(JSON.stringify(map)).toString("base64")
      output = writeSourceMapLocation({
        source: output,
        location: `data:application/json;charset=utf-8;base64,${mapAsBase64}`,
      })
    } else if (remapMethod === "comment") {
      // sourceMap will be named file.js.map
      const sourceMapName = `${path.basename(file)}.map`
      // it will be located at `${compileServer.origin}/build/src/file.js/e3uiyi456&/file.js.map`
      // const folder = path.dirname(file)
      // const folderWithSepOrNothing = folder ? `${folder}/` : ""
      const sourceMapLocationForSource = `./${path.basename(file)}__meta__/${sourceMapName}`

      output = writeSourceMapLocation({
        source: output,
        location: sourceMapLocationForSource,
      })
      assets.push(sourceMapName)
      assetsContent.push(stringifyMap(map))
    }
  } else {
    sources.push(file)
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
