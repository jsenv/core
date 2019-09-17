import { basename } from "path"
import {
  pathnameToOperatingSystemPath,
  pathnameToRelativePathname,
  pathnameIsInside,
} from "@jsenv/operating-system-path"
import { resolvePath, hrefToPathname } from "@jsenv/module-resolution"
import { jsenvTransform } from "./jsenvTransform.js"
import { writeSourceMappingURL } from "./source-mapping-url.js"
import { namedMetaToMetaMap, resolveMetaMapPatterns, urlToMeta } from "@jsenv/url-meta"

export const compileJs = async ({
  code,
  codeHref,
  codeSourceMap,
  projectPathname,
  babelPluginMap,
  convertMap = {},
  allowTopLevelAwait = true,
  transformTopLevelAwait = true,
  transformModuleIntoSystemFormat = true,
  transformGenerator = true,
  remap = true,
  remapMethod = "comment", // 'comment', 'inline'
}) => {
  if (typeof code !== "string") {
    throw new TypeError(`code must be a string, got ${code}`)
  }
  if (typeof codeHref !== "string") {
    throw new TypeError(`codeHref must be a string, got ${codeHref}`)
  }
  if (typeof projectPathname !== "string") {
    throw new TypeError(`projectPathname must be a string, got ${projectPathname}`)
  }
  if (typeof babelPluginMap !== "object") {
    throw new TypeError(`babelPluginMap must be an object, got ${babelPluginMap}`)
  }

  const { inputCode, inputMap } = await computeInputCodeAndInputMap({
    code,
    codeSourceMap,
    codeHref,
    projectPathname,
    convertMap,
    remap,
    allowTopLevelAwait,
  })
  const inputPath = computeInputPath({ codeHref, projectPathname })
  const inputRelativePath = computeInputRelativePath({ codeHref, projectPathname })

  const transformResult = await jsenvTransform({
    inputCode,
    inputMap,
    inputPath,
    inputRelativePath,
    babelPluginMap,
    convertMap,
    allowTopLevelAwait,
    transformTopLevelAwait,
    transformModuleIntoSystemFormat,
    transformGenerator,
    remap,
  })

  const sources = []
  const sourcesContent = []
  const assets = []
  const assetsContent = []

  const coverage = transformResult.metadata.coverage
  let output = transformResult.code
  const map = transformResult.map

  if (remap && map) {
    if (map.sources.length === 0) {
      // may happen in somae cases where babel returns a wrong sourcemap
      // there is at least one case where it happens
      // a file with only import './whatever.js' inside
      sources.push(computeCodePathForSourceMap({ codeHref, projectPathname }))
      sourcesContent.push(code)
    } else {
      map.sources = map.sources.map((source) =>
        sourceToSourceForSourceMap(source, { codeHref, projectPathname }),
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
        codeHref,
        assetName: `${codeHrefToBasename(codeHref)}.map`,
      })
      output = writeSourceMappingURL(output, `./${sourceMapAssetPath}`)
      assets.push(sourceMapAssetPath)
      assetsContent.push(stringifyMap(map))
    }
  } else {
    sources.push(computeCodePathForSourceMap({ codeHref, projectPathname }))
    sourcesContent.push(code)
  }

  if (coverage) {
    const coverageAssetPath = generateAssetPath({
      codeHref,
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

const computeInputCodeAndInputMap = async ({
  code,
  codeHref,
  codeSourceMap,
  projectPathname,
  convertMap,
  remap,
  allowTopLevelAwait,
}) => {
  const metaMap = resolveMetaMapPatterns(
    namedMetaToMetaMap({
      convert: convertMap,
    }),
    `file://${projectPathname}`,
  )
  const { convert } = urlToMeta({ url: codeHref, metaMap })
  if (!convert) {
    return { inputCode: code, inputMap: codeSourceMap }
  }

  if (typeof convert !== "function") {
    throw new TypeError(`convert must be a function, got ${convert}`)
  }
  // TODO: update @jsenv/commonjs-converter to handle sourceMap when passed
  const conversionResult = await convert({
    source: code,
    sourceHref: codeHref,
    sourceMap: codeSourceMap,
    remap,
    allowTopLevelAwait,
  })
  if (typeof conversionResult !== "object") {
    throw new TypeError(`convert must return an object, got ${conversionResult}`)
  }
  const inputCode = conversionResult.code
  if (typeof inputCode !== "string") {
    throw new TypeError(`convert must return { code } string, got { code: ${inputCode} } `)
  }
  const inputMap = conversionResult.map
  return { inputCode, inputMap }
}

const computeInputPath = ({ codeHref, projectPathname }) => {
  const scenario = computeScenario({ projectPathname, codeHref })

  if (scenario === "remote") {
    return codeHref
  }

  return pathnameToOperatingSystemPath(hrefToPathname(codeHref))
}

const computeInputRelativePath = ({ codeHref, projectPathname }) => {
  const scenario = computeScenario({ projectPathname, codeHref })

  if (scenario === "project-file") {
    return pathnameToRelativePathname(hrefToPathname(codeHref), projectPathname)
  }

  return undefined
}

const computeScenario = ({ projectPathname, codeHref }) => {
  if (!codeHref.startsWith("file:///")) {
    return "remote"
  }

  const sourcePathname = hrefToPathname(codeHref)

  if (pathnameIsInside(sourcePathname, projectPathname)) {
    return "project-file"
  }

  return "file"
}

const computeCodePathForSourceMap = ({ codeHref, projectPathname }) => {
  const relativePath = computeInputRelativePath({ codeHref, projectPathname })
  return relativePath || codeHref
}

const codeHrefToBasename = (codeHref) => basename(hrefToPathname(codeHref))

const sourceToSourceForSourceMap = (source, { projectPathname, codeHref }) => {
  if (source[0] === "/") {
    return source
  }

  if (source.slice(0, 2) === "./" || source.slice(0, 3) === "../") {
    const sourceHref = resolvePath({
      specifier: source,
      importer: codeHref,
    })
    const sourcePathname = hrefToPathname(sourceHref)
    const sourceRelativePath = pathnameToRelativePathname(sourcePathname, projectPathname)
    return sourceRelativePath
  }

  if (source.startsWith("file://")) {
    return source
  }

  if (source.startsWith("http://")) {
    return source
  }

  if (source.startsWith("https://")) {
    return source
  }

  return `/${source}`
}

const generateAssetPath = ({ codeHref, assetName }) => {
  return `${codeHrefToBasename(codeHref)}__asset__/${assetName}`
}

const stringifyMap = (object) => JSON.stringify(object, null, "  ")

const stringifyCoverage = (object) => JSON.stringify(object, null, "  ")
