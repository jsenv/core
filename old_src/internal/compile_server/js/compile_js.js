import { generateSourcemapUrl } from "@jsenv/core/src/internal/sourcemap_utils.js"
import { transformWithBabel } from "@jsenv/core/src/internal/transform_js/transform_with_babel.js"
import { updateJsHotMeta } from "@jsenv/core/src/internal/autoreload/hot_js.js"

import { asCompilationResult } from "../jsenv_directory/compilation_result.js"
import { shakeBabelPluginMap } from "../jsenv_directory/compile_profile.js"

export const compileJavascript = async ({
  projectDirectoryUrl,
  ressourceGraph,
  sourceFileFetcher,
  url,
  compiledUrl,

  type,
  compileProfile,
  babelPluginMap,
  topLevelAwait,
  prependSystemJs,
  importMetaHot,

  sourcemapExcludeSources,
  sourcemapMethod,
  map,
  content,
}) => {
  if (prependSystemJs === undefined) {
    prependSystemJs = type === "worker" || type === "service_worker"
  }
  const transformResult = await transformWithBabel({
    projectDirectoryUrl,
    sourceFileFetcher,
    url,
    compiledUrl,

    babelPluginMap: shakeBabelPluginMap({
      babelPluginMap,
      compileProfile,
    }),
    moduleOutFormat:
      type === "script" ? "global" : compileProfile.moduleOutFormat,
    importMetaHot,
    topLevelAwait: type === "script" ? false : topLevelAwait,
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
      sourceFileFetcher,
      sourceFileUrl: url,
      compiledFileUrl: compiledUrl,
      // sourcemap are not inside the asset folder because
      // of https://github.com/microsoft/vscode-chrome-debug-core/issues/544
      sourcemapFileUrl: generateSourcemapUrl(compiledUrl),
      sourcemapExcludeSources,
      sourcemapMethod,
      sourceFileContent: content,
    },
  )
}
