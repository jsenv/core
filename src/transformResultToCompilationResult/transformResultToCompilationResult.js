import { basename } from "path"
import { pathnameToRelativePathname } from "@jsenv/operating-system-path"
import { hrefToPathname } from "@jsenv/href"
import { resolvePath } from "@jsenv/module-resolution"
import { computeInputRelativePath } from "../transformJs/transformJs.js"
import { writeSourceMappingURL } from "./source-mapping-url.js"

export const transformResultToCompilationResult = (
  { code, map, metadata },
  {
    sourceHref,
    projectPathname,
    remap = true,
    remapMethod = "comment", // 'comment', 'inline'
  },
) => {
  const sources = []
  const sourcesContent = []
  const assets = []
  const assetsContent = []

  const { coverage } = metadata
  let output = code

  if (remap && map) {
    if (map.sources.length === 0) {
      // may happen in somae cases where babel returns a wrong sourcemap
      // there is at least one case where it happens
      // a file with only import './whatever.js' inside
      sources.push(sourceHrefToSourceMapSource({ sourceHref, projectPathname }))
      sourcesContent.push(code)
    } else {
      map.sources = map.sources.map((source) =>
        resolveSourceMapSource(source, { sourceHref, projectPathname }),
      )
      sources.push(...map.sources)
      if (map.sourcesContent) sourcesContent.push(...map.sourcesContent)
    }

    // removing sourcesContent from map decrease the sourceMap
    // it also means client have to fetch source from server (additional http request)
    // some client ignore sourcesContent property such as vscode-chrome-debugger
    // Because it's the most complex scenario and we want to ensure client is always able
    // to find source from the sourcemap, we explicitely delete nmap.sourcesContent to test this.
    delete map.sourcesContent

    // we don't need sourceRoot because our path are relative or absolute to the current location
    // we could comment this line because it is not set by babel because not passed during transform
    delete map.sourceRoot

    if (remapMethod === "inline") {
      const mapAsBase64 = new Buffer(JSON.stringify(map)).toString("base64")
      output = writeSourceMappingURL(
        output,
        `data:application/json;charset=utf-8;base64,${mapAsBase64}`,
      )
    } else if (remapMethod === "comment") {
      const sourceMapAssetPath = generateAssetPath({
        sourceHref,
        assetName: `${sourceHrefToBasename(sourceHref)}.map`,
      })
      output = writeSourceMappingURL(output, `./${sourceMapAssetPath}`)
      assets.push(sourceMapAssetPath)
      assetsContent.push(stringifyMap(map))
    }
  } else {
    sources.push(sourceHrefToSourceMapSource({ sourceHref, projectPathname }))
    sourcesContent.push(code)
  }

  if (coverage) {
    const coverageAssetPath = generateAssetPath({
      sourceHref,
      assetName: "coverage.json",
    })
    assets.push(coverageAssetPath)
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
}

const sourceHrefToSourceMapSource = ({ sourceHref, projectPathname }) => {
  const relativePath = computeInputRelativePath({ sourceHref, projectPathname })
  return relativePath || sourceHref
}

const resolveSourceMapSource = (sourceMapSource, { sourceHref, projectPathname }) => {
  if (sourceMapSource[0] === "/") {
    return sourceMapSource
  }

  if (sourceMapSource.slice(0, 2) === "./" || sourceMapSource.slice(0, 3) === "../") {
    const sourceMapSourceHref = resolvePath({
      specifier: sourceMapSource,
      importer: sourceHref,
    })
    const sourceMapSourcePathname = hrefToPathname(sourceMapSourceHref)
    return pathnameToRelativePathname(sourceMapSourcePathname, projectPathname)
  }

  if (sourceMapSource.startsWith("file://")) {
    return sourceMapSource
  }

  if (sourceMapSource.startsWith("http://")) {
    return sourceMapSource
  }

  if (sourceMapSource.startsWith("https://")) {
    return sourceMapSource
  }

  return `/${sourceMapSource}`
}

const generateAssetPath = ({ sourceHref, assetName }) => {
  return `${sourceHrefToBasename(sourceHref)}__asset__/${assetName}`
}

const sourceHrefToBasename = (sourceHref) => basename(hrefToPathname(sourceHref))

const stringifyMap = (object) => JSON.stringify(object, null, "  ")

const stringifyCoverage = (object) => JSON.stringify(object, null, "  ")
