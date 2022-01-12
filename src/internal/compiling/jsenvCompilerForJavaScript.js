import { transformJs } from "./js-compilation-service/transformJs.js"
import { transformResultToCompilationResult } from "./transformResultToCompilationResult.js"

export const compileJavascript = async ({
  code,
  map,
  url,
  compiledUrl,
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,

  babelPluginMap,
  workerUrls,
  serviceWorkerUrls,
  moduleOutFormat,
  importMetaFormat,
  topLevelAwait,
  prependSystemJs,

  sourcemapExcludeSources,
  sourcemapMethod,
}) => {
  if (prependSystemJs === undefined) {
    prependSystemJs =
      workerUrls.includes(url) || serviceWorkerUrls.includes(url)
  }

  const transformResult = await transformJs({
    code,
    map,
    url,
    compiledUrl,
    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,

    babelPluginMap,
    moduleOutFormat,
    importMetaFormat,
    topLevelAwait,
    prependSystemJs,
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
      // sourcemap are not inside the asset folder because
      // of https://github.com/microsoft/vscode-chrome-debug-core/issues/544
      sourcemapFileUrl: `${compiledUrl}.map`,
      sourcemapExcludeSources,
      sourcemapMethod,
    },
  )
}
