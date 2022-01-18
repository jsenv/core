import { generateSourcemapUrl } from "@jsenv/core/src/internal/sourceMappingURLUtils.js"

import { transformJs } from "./js-compilation-service/transformJs.js"
import { transformResultToCompilationResult } from "./transformResultToCompilationResult.js"

export const compileJavascript = async ({
  projectDirectoryUrl,
  jsenvRemoteDirectory,
  url,
  compiledUrl,

  babelPluginMap,
  workerUrls,
  serviceWorkerUrls,
  moduleOutFormat,
  importMetaFormat,
  topLevelAwait,
  prependSystemJs,

  code,
  map,
  sourcemapExcludeSources,
  sourcemapMethod,
}) => {
  if (prependSystemJs === undefined) {
    prependSystemJs =
      workerUrls.includes(url) || serviceWorkerUrls.includes(url)
  }
  const transformResult = await transformJs({
    projectDirectoryUrl,
    jsenvRemoteDirectory,
    url,
    compiledUrl,

    babelPluginMap,
    moduleOutFormat,
    importMetaFormat,
    topLevelAwait,
    prependSystemJs,

    code,
    map,
  })
  return transformResultToCompilationResult(
    {
      contentType: "application/javascript",
      metadata: transformResult.metadata,
      code: transformResult.code,
      map: transformResult.map,
    },
    {
      projectDirectoryUrl,
      jsenvRemoteDirectory,
      originalFileUrl: url,
      compiledFileUrl: compiledUrl,
      // sourcemap are not inside the asset folder because
      // of https://github.com/microsoft/vscode-chrome-debug-core/issues/544
      sourcemapFileUrl: generateSourcemapUrl(compiledUrl),
      sourcemapExcludeSources,
      sourcemapMethod,
      originalFileContent: code,
    },
  )
}
