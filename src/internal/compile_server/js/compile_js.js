import { generateSourcemapUrl } from "@jsenv/core/src/internal/sourcemap_utils.js"

import { asCompilationResult } from "@jsenv/core/src/internal/compile_server/jsenv_directory/compilation_result.js"
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

    babelPluginMap: shakeBabelPluginMap({
      babelPluginMap,
      compileProfile,
    }),
    moduleOutFormat: compileProfile.moduleOutFormat,
    topLevelAwait,
    prependSystemJs,

    code,
    map,
  })
  const metadata = transformResult.metadata
  ressourceGraph.updateRessourceDependencies({
    url,
    type: "js",
    dependencyUrls: metadata.dependencies.map((dependencyUrlSpecifier) => {
      // TODO: use ressourceGraph.resolveAssetUrl
      // for import.meta.url + new URL)
      return ressourceGraph.applyImportmapResolution(
        dependencyUrlSpecifier,
        url,
      )
    }),
    importMetaHotDecline: metadata.importMetaHotDecline,
    importMetaHotAcceptSelf: metadata.importMetaHotAcceptSelf,
    importMetaHotAcceptDependencies:
      metadata.importMetaHotAcceptDependencies.map(
        (acceptDependencyUrlSpecifier) =>
          ressourceGraph.applyImportmapResolution(
            acceptDependencyUrlSpecifier,
            url,
          ),
      ),
  })
  return asCompilationResult(
    {
      contentType: "application/javascript",
      metadata,
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
