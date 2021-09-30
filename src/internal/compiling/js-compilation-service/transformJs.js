import {
  urlToRelativeUrl,
  normalizeStructuredMetaMap,
  urlToMeta,
} from "@jsenv/filesystem"

import { jsenvTransform } from "./jsenvTransform.js"

export const transformJs = async ({
  code,
  map,
  url,
  urlAfterTransform,
  projectDirectoryUrl,

  babelPluginMap,
  convertMap = {},
  moduleOutFormat = "esmodule",
  importMetaFormat = moduleOutFormat,
  babelHelpersInjectionAsImport = true,
  allowTopLevelAwait = true,
  transformTopLevelAwait = true,
  transformGenerator = true,
  transformGlobalThis = true,
  sourcemapEnabled = true,
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(
      `projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`,
    )
  }
  if (typeof babelPluginMap !== "object") {
    throw new TypeError(
      `babelPluginMap must be an object, got ${babelPluginMap}`,
    )
  }
  if (typeof code === "undefined") {
    throw new TypeError(`code missing, received ${code}`)
  }
  if (typeof url !== "string") {
    throw new TypeError(`url must be a string, got ${url}`)
  }

  const conversionResult = await applyConvertMap({
    code,
    map,
    url,
    urlAfterTransform,
    projectDirectoryUrl,

    convertMap,
    sourcemapEnabled,
    allowTopLevelAwait,
  })
  code = conversionResult.code
  map = conversionResult.map

  const transformResult = await jsenvTransform({
    code,
    map,
    url,
    relativeUrl: url.startsWith(projectDirectoryUrl)
      ? urlToRelativeUrl(url, projectDirectoryUrl)
      : undefined,

    babelPluginMap,
    moduleOutFormat,
    importMetaFormat,

    babelHelpersInjectionAsImport,
    allowTopLevelAwait,
    transformTopLevelAwait,
    transformGenerator,
    transformGlobalThis,
    sourcemapEnabled,
  })
  code = transformResult.code
  map = transformResult.map
  const { metadata } = transformResult
  return { code, map, metadata }
}

const applyConvertMap = async ({
  code,
  map,
  url,
  urlAfterTransform,
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
    return { code, map }
  }

  if (typeof convert !== "function") {
    throw new TypeError(`convert must be a function, got ${convert}`)
  }
  const convertReturnValue = await convert({
    code,
    map,
    url,
    urlAfterTransform,
    projectDirectoryUrl,

    remap,
    allowTopLevelAwait,
  })
  if (typeof convertReturnValue !== "object") {
    throw new TypeError(
      `convert must return an object, got ${convertReturnValue}`,
    )
  }
  code = convertReturnValue.code
  map = convertReturnValue.map
  if (typeof code !== "string") {
    throw new TypeError(
      `convert return value "code" property must be a string, got ${code}`,
    )
  }
  return { code, map }
}
