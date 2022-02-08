import { generateSourcemapUrl } from "@jsenv/core/src/internal/sourcemap_utils.js"
import { transformWithBabel } from "@jsenv/core/src/internal/transform_js/transform_with_babel.js"
import { updateJsHotMeta } from "@jsenv/core/src/internal/autoreload/hot_js.js"

import { asCompilationResult } from "../jsenv_directory/compilation_result.js"
import { shakeBabelPluginMap } from "../jsenv_directory/compile_profile.js"

export const compileJavascript = async ({
  projectDirectoryUrl,
  ressourceGraph,
  jsenvRemoteDirectory,
  url,
  compiledUrl,

  compileProfile,
  babelPluginMap,
  topLevelAwait,
  prependSystemJs,

  sourcemapExcludeSources,
  sourcemapMethod,
  map,
  content,
}) => {
  const { searchParams } = new URL(url)
  if (prependSystemJs === undefined) {
    prependSystemJs =
      searchParams.has("worker") || searchParams.has("service_worker")
  }
  const transformResult = await transformWithBabel({
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

    map,
    content,
  })
  const { metadata } = transformResult
  updateJsHotMeta({
    ressourceGraph,
    url,
    urlMentions: metadata.urlMentions,
    importMetaHotDecline: metadata.importMetaHotDecline,
    importMetaHotAcceptSelf: metadata.importMetaHotAcceptSelf,
    importMetaHotAcceptDependencies: metadata.importMetaHotAcceptDependencies,
  })
  return asCompilationResult(
    {
      contentType: "application/javascript",
      content: transformResult.content,
      coverage: metadata.coverage,
      dependencies: metadata.urlMentions.map(({ specifier }) => specifier),
      map: transformResult.map,
    },
    {
      projectDirectoryUrl,
      jsenvRemoteDirectory,
      sourceFileUrl: url,
      compiledFileUrl: compiledUrl,
      // sourcemap are not inside the asset folder because
      // of https://github.com/microsoft/vscode-chrome-debug-core/issues/544
      sourcemapFileUrl: generateSourcemapUrl(compiledUrl),
      sourcemapExcludeSources,
      sourcemapMethod,
      originalFileContent: content,
    },
  )
}
