import { generateSourcemapUrl } from "@jsenv/core/src/internal/sourcemap_utils.js"
import { scanJs } from "@jsenv/core/src/internal/hmr/scan_js.js"

import { asCompilationResult } from "../jsenv_directory/compilation_result.js"
import { shakeBabelPluginMap } from "../jsenv_directory/compile_profile.js"
import { transformJs } from "./js_transformer.js"

export const compileJavascript = async ({
  projectDirectoryUrl,
  jsenvRemoteDirectory,
  url,
  compiledUrl,
  ressourceGraph,

  compileProfile,
  babelPluginMap,
  topLevelAwait,
  prependSystemJs,

  code,
  map,
  sourcemapExcludeSources,
  sourcemapMethod,
}) => {
  const { searchParams } = new URL(url)
  if (prependSystemJs === undefined) {
    prependSystemJs =
      searchParams.has("worker") || searchParams.has("service_worker")
  }
  const transformResult = await transformJs({
    projectDirectoryUrl,
    jsenvRemoteDirectory,
    url,
    compiledUrl,

    babelPluginMap: shakeBabelPluginMap({
      babelPluginMap,
      compileProfile,
    }),
    moduleOutFormat: searchParams.has("script")
      ? "global"
      : compileProfile.moduleOutFormat,
    topLevelAwait,
    prependSystemJs,

    code,
    map,
  })
  const metadata = transformResult.metadata
  scanJs({
    ressourceGraph,
    url,
    metadata,
  })
  return asCompilationResult(
    {
      contentType: "application/javascript",
      coverage: metadata.coverage,
      dependencies: metadata.urlMentions.map(({ specifier }) => specifier),
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
