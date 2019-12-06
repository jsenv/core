import { metaMapToSpecifierMetaMap, normalizeSpecifierMetaMap, urlToMeta } from "@jsenv/url-meta"
import { urlToFilePath, fileUrlToRelativePath } from "internal/urlUtils.js"
import { jsenvTransform } from "./jsenvTransform.js"

export const transformJs = async ({
  projectDirectoryUrl,
  code,
  url,
  urlAfterTransform,
  map,
  babelPluginMap,
  convertMap = {},
  allowTopLevelAwait = true,
  transformTopLevelAwait = true,
  transformModuleIntoSystemFormat = true,
  transformGenerator = true,
  transformGlobalThis = true,
  remap = true,
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`)
  }
  if (typeof babelPluginMap !== "object") {
    throw new TypeError(`babelPluginMap must be an object, got ${babelPluginMap}`)
  }
  if (typeof code !== "string") {
    throw new TypeError(`code must be a string, got ${code}`)
  }
  if (typeof url !== "string") {
    throw new TypeError(`url must be a string, got ${url}`)
  }

  const { inputCode, inputMap } = await computeInputCodeAndInputMap({
    code,
    url,
    urlAfterTransform,
    map,
    projectDirectoryUrl,
    convertMap,
    remap,
    allowTopLevelAwait,
  })
  const inputPath = computeInputPath(url)
  const inputRelativePath = computeInputRelativePath(url, projectDirectoryUrl)

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
    transformGlobalThis,
    remap,
  })
}

const computeInputCodeAndInputMap = async ({
  code,
  url,
  urlAfterTransform,
  map,
  projectDirectoryUrl,
  convertMap,
  remap,
  allowTopLevelAwait,
}) => {
  const specifierMetaMap = normalizeSpecifierMetaMap(
    metaMapToSpecifierMetaMap({
      convert: convertMap,
    }),
    projectDirectoryUrl,
  )
  const { convert } = urlToMeta({ url, specifierMetaMap })
  if (!convert) {
    return { inputCode: code, inputMap: map }
  }

  if (typeof convert !== "function") {
    throw new TypeError(`convert must be a function, got ${convert}`)
  }
  // TODO: handle map when passed
  const conversionResult = await convert({
    projectDirectoryUrl,
    code,
    url,
    urlAfterTransform,
    map,
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

const computeInputPath = (url) => {
  if (url.startsWith("file://")) {
    return urlToFilePath(url)
  }
  return url
}

export const computeInputRelativePath = (url, projectDirectoryUrl) => {
  if (url.startsWith(projectDirectoryUrl)) {
    return fileUrlToRelativePath(url, projectDirectoryUrl)
  }
  return undefined
}
