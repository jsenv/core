import { urlToRelativeUrl } from "@jsenv/filesystem"

import { jsenvTransform } from "./jsenvTransform.js"

export const transformJs = async ({
  code,
  map,
  url,
  projectDirectoryUrl,

  babelPluginMap,
  moduleOutFormat = "esmodule",
  importMetaFormat = moduleOutFormat,
  babelHelpersInjectionAsImport = moduleOutFormat === "esmodule",
  topLevelAwait,
  transformGenerator = true,
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
  if (babelHelpersInjectionAsImport && moduleOutFormat !== "esmodule") {
    throw new Error(
      `babelHelpersInjectionAsImport can be enabled only when "moduleOutFormat" is "esmodule"`,
    )
  }

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
    topLevelAwait,
    transformGenerator,
    sourcemapEnabled,
  })
  code = transformResult.code
  map = transformResult.map
  const { metadata } = transformResult
  return { code, map, metadata }
}
