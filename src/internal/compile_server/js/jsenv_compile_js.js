import { generateSourcemapUrl } from "@jsenv/core/src/internal/sourceMappingURLUtils.js"

import { asCompilationResult } from "@jsenv/core/src/internal/compile_server/jsenv_directory/compilation_result.js"

import { transformJs } from "./js_transformer.js"

export const compileJavascript = async ({
  projectDirectoryUrl,
  jsenvRemoteDirectory,
  url,
  compiledUrl,

  compileProfile,
  babelPluginMap,
  topLevelAwait,
  prependSystemJs,

  code,
  map,
  sourcemapExcludeSources,
  sourcemapMethod,
}) => {
  if (prependSystemJs === undefined) {
    const { searchParams } = new URL(url)
    prependSystemJs =
      searchParams.has("worker") || searchParams.has("service_worker")
  }
  const transformResult = await transformJs({
    projectDirectoryUrl,
    jsenvRemoteDirectory,
    url,
    compiledUrl,

    babelPluginMap,
    moduleOutFormat: compileProfile.moduleOutFormat,
    topLevelAwait,
    prependSystemJs,

    code,
    map,
  })
  return asCompilationResult(
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
