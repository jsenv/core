import path from "path"
import { transpiler } from "./transpiler.js"
import { packager } from "./packager.js"

const writeSourceMapLocation = ({ source, location }) => {
  return `${source}
${"//#"} sourceMappingURL=${location}`
}

const stringifyMap = (object) => JSON.stringify(object, null, "  ")

const stringifyCoverage = (object) => JSON.stringify(object, null, "  ")

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

  if (file === "node_module/dev-server/src/platform/browser/index.js") {
    const result = await packager({ localRoot, fileAbsolute, pluginMap, remap })

    map = result.map
    output = result.code

    sources.push(...map.sources)
    sourcesContent.push(...map.sourcesContent)
    delete map.sourceRoot
    // not sure it will work because the sources are relative to here
    // when a project will use this one, sources should be relative to the project
    // but able to find the file here, seems hard to obtain this
    // delete map.sourcesContent
    /*
		depuis dev-server-poc

		on fera donc

		node_module/dev-server/src/platform/browser/index.js

		ce qui fera locate et trouvera le fichier dans 'node_module/dev-server/src/platform/browser/index.js'
		voir ailleurs en fait, l'important c'est le file de depart

		ensuite donc le sourcemap devra indiquer le file, ca ok
		et il devra dire ou sont ses sources
		elle devront indiquer node_module/dev-server/src/platform/dependency.js par ex

		a verifier
		*/
    map.sources = map.sources.map((source) => sourceToSourceForSourceMap(source))
    map.file = file
  } else {
    const result = await transpiler({
      localRoot,
      file,
      fileAbsolute,
      inputAst,
      input,
      inputMap,
      pluginMap,
      remap,
    })

    map = result.map
    coverage = result.metadata.coverage
    output = result.code

    sources.push(...map.sources)
    sourcesContent.push(...map.sourcesContent)
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
    map.file = file
    // this file name supposed to appear in dev tools
  }

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
      const sourceMapLocationForSource = `${path.basename(file)}__meta__/${sourceMapName}`

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
