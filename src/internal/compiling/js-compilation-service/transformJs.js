import {
  resolveUrl,
  urlToFileSystemPath,
  urlToRelativeUrl,
  normalizeStructuredMetaMap,
  urlToMeta,
} from "@jsenv/util"
import { jsenvTransform } from "./jsenvTransform.js"

export const transformJs = async ({
  projectDirectoryUrl,
  code,
  url,
  urlAfterTransform,
  map,

  babelPluginMap,
  convertMap = {},
  moduleOutFormat = "esmodule",
  importMetaFormat = moduleOutFormat,
  importMetaEnvFileRelativeUrl,
  importMeta,

  allowTopLevelAwait = true,
  transformTopLevelAwait = true,
  transformGenerator = true,
  transformGlobalThis = true,
  sourcemapEnabled = true,
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`)
  }
  if (typeof babelPluginMap !== "object") {
    throw new TypeError(`babelPluginMap must be an object, got ${babelPluginMap}`)
  }
  if (typeof code === "undefined") {
    throw new TypeError(`code missing, received ${code}`)
  }
  if (typeof url !== "string") {
    throw new TypeError(`url must be a string, got ${url}`)
  }

  const { inputCode, inputMap } = await computeInputCodeAndInputMap({
    code: String(code),
    url,
    urlAfterTransform,
    map,
    projectDirectoryUrl,
    convertMap,
    sourcemapEnabled,
    allowTopLevelAwait,
  })
  const inputPath = computeInputPath(url)
  const inputRelativePath = computeInputRelativePath(url, projectDirectoryUrl)

  const importMetaEnvFileUrl = resolveUrl(importMetaEnvFileRelativeUrl, projectDirectoryUrl)
  const importMetaEnvRelativeUrlForInput = urlToRelativeUrl(importMetaEnvFileUrl, url)
  const importMetaEnvFileSpecifier = relativeUrlToSpecifier(importMetaEnvRelativeUrlForInput)

  return jsenvTransform({
    inputCode,
    inputMap,
    inputPath,
    inputRelativePath,

    babelPluginMap,
    convertMap,
    moduleOutFormat,
    importMetaFormat,
    importMetaEnvFileSpecifier,
    importMeta,

    allowTopLevelAwait,
    transformTopLevelAwait,
    transformGenerator,
    transformGlobalThis,
    sourcemapEnabled,
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
  const structuredMetaMap = normalizeStructuredMetaMap(
    {
      convert: convertMap,
    },
    projectDirectoryUrl,
  )
  const { convert } = urlToMeta({ url, structuredMetaMap })
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
    return urlToFileSystemPath(url)
  }
  return url
}

const computeInputRelativePath = (url, projectDirectoryUrl) => {
  if (url.startsWith(projectDirectoryUrl)) {
    return urlToRelativeUrl(url, projectDirectoryUrl)
  }
  return undefined
}

const relativeUrlToSpecifier = (relativeUrl) => {
  if (relativeUrl.startsWith("../")) return relativeUrl
  if (relativeUrl.startsWith("./")) return relativeUrl
  return `./${relativeUrl}`
}
