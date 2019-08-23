import { basename } from "path"
import { fileRead } from "@dmail/helper"
import {
  pathnameToOperatingSystemPath,
  pathnameToRelativePathname,
} from "@jsenv/operating-system-path"
import { resolvePath, hrefToPathname } from "@jsenv/module-resolution"
import { transformSource } from "@jsenv/core"
import { writeSourceMappingURL } from "./source-mapping-url.js"

export const compileJs = async ({
  projectPathname,
  sourceRelativePath,
  babelPluginMap,
  convertMap,
  transformTopLevelAwait,
  remap = true,
  remapMethod = "comment", // 'comment', 'inline'
}) => {
  if (typeof babelPluginMap !== "object")
    throw new TypeError(`babelPluginMap must be an object, got ${babelPluginMap}`)

  const sources = []
  const sourcesContent = []
  const assets = []
  const assetsContent = []

  const sourcePathname = `${projectPathname}${sourceRelativePath}`
  const sourcePath = pathnameToOperatingSystemPath(sourcePathname)
  const source = await fileRead(sourcePath)
  const { map, code, metadata } = await transformSource({
    projectPathname,
    source,
    sourceHref: `file://${sourcePathname}`,
    babelPluginMap,
    convertMap,
    transformTopLevelAwait,
    remap,
  })
  const coverage = metadata.coverage
  let output = code

  if (remap && map) {
    if (map.sources.length === 0) {
      // may happen in somae cases where babel returns a wrong sourcemap
      // there is at least one case where it happens
      // a file with only import './whatever.js' inside
      sources.push(sourceRelativePath)
      sourcesContent.push(source)
    } else {
      map.sources = map.sources.map((source) =>
        sourceToSourceForSourceMap(source, { projectPathname, mainPathname: sourcePathname }),
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
    sources.push(sourceRelativePath)
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
}

const sourceToSourceForSourceMap = (source, { projectPathname, mainPathname }) => {
  if (source[0] === "/") {
    return source
  }

  if (source.slice(0, 2) === "./" || source.slice(0, 3) === "../") {
    const sourceHref = resolvePath({
      specifier: source,
      importer: `http://example.com${mainPathname}}`,
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
