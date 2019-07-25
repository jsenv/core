import { basename } from "path"
import {
  pathnameToOperatingSystemPath,
  operatingSystemPathToPathname,
  pathnameToRelativePathname,
} from "@jsenv/operating-system-path"
import { resolvePath, hrefToPathname } from "@jsenv/module-resolution"
import { writeSourceMappingURL } from "../source-mapping-url.js"
import { ansiToHTML } from "../ansiToHTML.js"
import { createParseError } from "../compiled-file-service/index.js"
import { transpiler } from "./transpiler.js"

export const compileJs = async ({
  source,
  projectPathname,
  sourceRelativePath,
  babelPluginMap,
  transformTopLevelAwait,
  inputAst = undefined,
  inputMap = undefined,
  remap = true,
  remapMethod = "comment", // 'comment', 'inline'
}) => {
  if (typeof babelPluginMap !== "object")
    throw new TypeError(`babelPluginMap must be an object, got ${babelPluginMap}`)

  const sourceFilename = pathnameToOperatingSystemPath(`${projectPathname}${sourceRelativePath}`)

  try {
    const sources = []
    const sourcesContent = []
    const assets = []
    const assetsContent = []

    const { map, code, metadata } = await transpiler({
      input: source,
      filename: sourceFilename,
      filenameRelative: sourceRelativePath.slice(1),
      inputAst,
      inputMap,
      babelPluginMap,
      transformTopLevelAwait,
      remap,
    })
    const coverage = metadata.coverage
    let output = code

    if (remap && map) {
      map.sources = map.sources.map((source) => sourceToSourceForSourceMap(source, sourceFilename))
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
        const sourcemappathnameRelative = generateAssetpathnameRelative({
          projectPathname,
          sourceRelativePath,
          assetName: `${basename(sourceRelativePath)}.map`,
        })
        output = writeSourceMappingURL(output, `./${sourcemappathnameRelative}`)
        assets.push(sourcemappathnameRelative)
        assetsContent.push(stringifyMap(map))
      }
    } else {
      sources.push(`/${sourceRelativePath}`)
      sourcesContent.push(source)
    }

    if (coverage) {
      const coveragePathnameRelative = generateAssetpathnameRelative({
        projectPathname,
        sourceRelativePath,
        assetName: "coverage.json",
      })
      assets.push(coveragePathnameRelative)
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
      const message = error.message
      throw createParseError({
        message,
        messageHTML: ansiToHTML(message),
        filename: sourceFilename,
        lineNumber: error.loc.line,
        columnNumber: error.loc.column,
      })
    }
    throw error
  }
}

const sourceToSourceForSourceMap = (source, { projectPathname, sourceFilename }) => {
  if (source[0] === "/") {
    return source
  }

  if (source.slice(0, 2) === "./" || source.slice(0, 3) === "../") {
    const sourceHref = resolvePath({
      specifier: source,
      importer: `http://example.com${operatingSystemPathToPathname(sourceFilename)}`,
    })
    const sourcePathname = hrefToPathname(sourceHref)
    const sourceRelativePath = pathnameToRelativePathname(sourcePathname, projectPathname)
    return sourceRelativePath
  }

  return `/${source}`
}

const generateAssetpathnameRelative = ({ sourceRelativePath, assetName }) => {
  const fileBasename = basename(sourceRelativePath)

  return `${fileBasename}__asset__/${assetName}`
}

const stringifyMap = (object) => JSON.stringify(object, null, "  ")

const stringifyCoverage = (object) => JSON.stringify(object, null, "  ")
