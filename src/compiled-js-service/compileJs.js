import { sep, basename } from "path"
import { writeSourceMappingURL } from "../source-mapping-url.js"
import { ansiToHTML } from "../ansiToHTML.js"
import { regexpEscape } from "../stringHelper.js"
import { createParseError } from "../compiled-file-service/index.js"
import { transpiler } from "./transpiler.js"

export const compileJs = async ({
  projectFolder,
  filenameRelative,
  filename,
  source,
  babelConfigMap,
  transformTopLevelAwait,
  inputAst = undefined,
  inputMap = undefined,
  outputFilename = filename,
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
      map.sources = map.sources.map((source) => sourceToSourceForSourceMap(source))
      sources.push(...map.sources)
      if (map.sourcesContent) sourcesContent.push(...map.sourcesContent)

      // we don't need sourceRoot because our path are relative or absolute to the current location
      // we could comment this line because it is not set by babel because not passed during transform
      delete map.sourceRoot
      // removing sourcesContent from map decrease the sourceMap
      // it also means client have to fetch source from server (additional http request)
      // some client ignore sourcesContent property such as vscode-chrome-debugger
      // Because it's the most complex scenario and we want to ensure client is always able
      // to find source from the sourcemap, we explicitely delete nmap.sourcesContent to test this.
      delete map.sourcesContent

      if (remapMethod === "inline") {
        const mapAsBase64 = new Buffer(JSON.stringify(map)).toString("base64")
        output = writeSourceMappingURL(
          output,
          `data:application/json;charset=utf-8;base64,${mapAsBase64}`,
        )
      } else if (remapMethod === "comment") {
        const sourcemapFilenameRelative = generateAssetFilenameRelative({
          projectFolder,
          filenameRelative,
          assetName: `${basename(filenameRelative)}.map`,
        })
        output = writeSourceMappingURL(output, `./${sourcemapFilenameRelative}`)
        assets.push(sourcemapFilenameRelative)
        assetsContent.push(stringifyMap(map))
      }
    } else {
      sources.push(`/${filenameRelative}`)
      sourcesContent.push(source)
    }

    if (coverage) {
      const coverageFilenameRelative = generateAssetFilenameRelative({
        projectFolder,
        filenameRelative,
        assetName: "coverage.json",
      })
      assets.push(coverageFilenameRelative)
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
      const message = transformBabelParseErrorMessage(error.message, filename, outputFilename)
      throw createParseError({
        message,
        messageHTML: ansiToHTML(message),
        filename,
        outputFilename,
        lineNumber: error.loc.line,
        columnNumber: error.loc.column,
      })
    }
    throw error
  }
}

const generateAssetFilenameRelative = ({ filenameRelative, assetName }) => {
  const fileBasename = basename(filenameRelative)

  return `${fileBasename}__asset__/${assetName}`
}

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
