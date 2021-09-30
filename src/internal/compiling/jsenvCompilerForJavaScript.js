import { transformJs } from "./js-compilation-service/transformJs.js"
import { transformResultToCompilationResult } from "./transformResultToCompilationResult.js"

export const compileJavascript = async ({
  code,
  map,
  url,
  compiledUrl,
  projectDirectoryUrl,

  babelPluginMap,
  transformTopLevelAwait,
  moduleOutFormat,
  importMetaFormat,

  sourcemapExcludeSources,
}) => {
  const transformResult = await transformJs({
    code,
    map,
    url,
    compiledUrl,
    projectDirectoryUrl,

    babelPluginMap,
    transformTopLevelAwait,
    moduleOutFormat,
    importMetaFormat,
  })

  return transformResultToCompilationResult(
    {
      contentType: "application/javascript",
      code: transformResult.code,
      map: transformResult.map,
      metadata: transformResult.metadata,
    },
    {
      projectDirectoryUrl,
      originalFileContent: code,
      originalFileUrl: url,
      compiledFileUrl: compiledUrl,
      sourcemapFileUrl: `${compiledUrl}.map`,
      sourcemapExcludeSources,
    },
  )
}
