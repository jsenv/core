import {
  pathnameToOperatingSystemPath,
  pathnameToRelativePathname,
  pathnameIsInside,
} from "@jsenv/operating-system-path"
import { hrefToPathname } from "@jsenv/href"
import { jsenvTransform } from "./jsenvTransform.js"
import { namedMetaToMetaMap, resolveMetaMapPatterns, urlToMeta } from "@jsenv/url-meta"

export const transformJs = async ({
  source,
  sourceHref,
  sourceMap,
  projectPathname,
  babelPluginMap,
  convertMap = {},
  allowTopLevelAwait = true,
  transformTopLevelAwait = true,
  transformModuleIntoSystemFormat = true,
  transformGenerator = true,
  remap = true,
}) => {
  if (typeof source !== "string") {
    throw new TypeError(`source must be a string, got ${source}`)
  }
  if (typeof sourceHref !== "string") {
    throw new TypeError(`sourceHref must be a string, got ${sourceHref}`)
  }
  if (typeof projectPathname !== "string") {
    throw new TypeError(`projectPathname must be a string, got ${projectPathname}`)
  }
  if (typeof babelPluginMap !== "object") {
    throw new TypeError(`babelPluginMap must be an object, got ${babelPluginMap}`)
  }

  const { inputCode, inputMap } = await computeInputCodeAndInputMap({
    source,
    sourceHref,
    sourceMap,
    projectPathname,
    convertMap,
    remap,
    allowTopLevelAwait,
  })
  const inputPath = computeInputPath({ sourceHref, projectPathname })
  const inputRelativePath = computeInputRelativePath({ sourceHref, projectPathname })

  return jsenvTransform({
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
}

const computeInputCodeAndInputMap = async ({
  source,
  sourceHref,
  sourceMap,
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
  const { convert } = urlToMeta({ url: sourceHref, metaMap })
  if (!convert) {
    return { inputCode: source, inputMap: sourceMap }
  }

  if (typeof convert !== "function") {
    throw new TypeError(`convert must be a function, got ${convert}`)
  }
  // TODO: update @jsenv/commonjs-converter to handle sourceMap when passed
  const conversionResult = await convert({
    source,
    sourceHref,
    sourceMap,
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

const computeInputPath = ({ sourceHref, projectPathname }) => {
  const scenario = computeScenario({ sourceHref, projectPathname })

  if (scenario === "remote") {
    return sourceHref
  }

  return pathnameToOperatingSystemPath(hrefToPathname(sourceHref))
}

export const computeInputRelativePath = ({ sourceHref, projectPathname }) => {
  const scenario = computeScenario({ sourceHref, projectPathname })

  if (scenario === "project-file") {
    return pathnameToRelativePathname(hrefToPathname(sourceHref), projectPathname)
  }

  return undefined
}

const computeScenario = ({ sourceHref, projectPathname }) => {
  if (!sourceHref.startsWith("file:///")) {
    return "remote"
  }

  const sourcePathname = hrefToPathname(sourceHref)

  if (pathnameIsInside(sourcePathname, projectPathname)) {
    return "project-file"
  }

  return "file"
}
