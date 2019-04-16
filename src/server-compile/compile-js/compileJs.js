import { sep, basename } from "path"
import { ansiToHTML } from "../../ansiToHTML.js"
import { regexpEscape } from "../../stringHelper.js"
import { createParseError } from "../compile-request-to-response/index.js"
import { transpiler } from "./transpiler.js"

export const compileJs = async ({
  projectFolder,
  compileInto,
  compileId,
  filenameRelative,
  filename,
  source,
  babelConfigMap = {},
  transformTopLevelAwait,
  inputAst,
  inputMap,
  origin = `file://${projectFolder}`,
  remap = true,
  remapMethod = "comment", // 'comment', 'inline'
}) => {
  try {
    const sources = []
    const sourcesContent = []
    const assets = []
    const assetsContent = []

    // source can be fetched at `${compileServer.origin}/src/file.js`
    const sourceToSourceForSourceMap = (source) => `/${source}`

    const { map, code, metadata } = await transpiler({
      input: source,
      filename,
      filenameRelative,
      projectFolder,
      inputAst,
      inputMap,
      babelConfigMap,
      transformTopLevelAwait,
      remap,
    })
    const coverage = metadata.coverage
    let output = code

    if (remap && map) {
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
        const sourceMapName = `${basename(filenameRelative)}.map`
        // it will be located at `${compileServer.origin}/.dist/src/file.js/e3uiyi456&/file.js.map`
        // const folder = path.dirname(file)
        // const folderWithSepOrNothing = folder ? `${folder}/` : ""
        const sourceMapLocationForSource = `./${basename(
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
      sourcesContent.push(source)
    }

    if (coverage) {
      assets.push("coverage.json")
      assetsContent.push(stringifyCoverage(coverage))
    }

    return {
      compiledSource: output,
      contentType: "application/javascript",
      sources,
      sourcesContent,
      assets,
      assetsContent,
    }
  } catch (error) {
    if (error && error.code === "BABEL_PARSE_ERROR") {
      const filename = `${projectFolder}/${filenameRelative}`
      const href = `${origin}/${compileInto}/${compileId}/${filenameRelative}`
      const message = transformBabelParseErrorMessage(error.message, filename, href)
      throw createParseError({
        message,
        messageHTML: ansiToHTML(message),
        filename,
        href,
        lineNumber: error.loc.line,
        columnNumber: error.loc.column,
      })
    }
    throw error
  }
}

export const writeSourceMapLocation = ({ source, location }) => `${source}
${"//#"} sourceMappingURL=${location}`

const stringifyMap = (object) => JSON.stringify(object, null, "  ")

const stringifyCoverage = (object) => JSON.stringify(object, null, "  ")

const transformBabelParseErrorMessage = (babelParseErrorMessage, filename, replacement) => {
  // the babelParseErrorMessage looks somehow like that:
  /*
  `${filename}: Unexpected token(${lineNumber}:${columnNumber}})

    ${lineNumber - 1} | ${sourceForThatLine}
  > ${lineNumber} | ${sourceForThatLine}
    | ^`
  */
  // and the idea is to replace ${filename} by somsething else

  const filenameString = sep === "/" ? filename : filename.replace(/\//g, "\\")
  const filenameRegexp = new RegExp(regexpEscape(filenameString), "gi")
  const parseErrorMessage = babelParseErrorMessage.replace(filenameRegexp, replacement)
  return parseErrorMessage
}
