import { urlToFilename, resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import {
  generateSourcemapUrl,
  getJavaScriptSourceMappingUrl,
  setJavaScriptSourceMappingUrl,
} from "@jsenv/core/src/internal/sourcemap_utils.js"

import { transformWorker } from "./transform_worker.js"

export const parseJsRessource = async (
  jsRessource,
  { notifyReferenceFound, asProjectUrl, asOriginalUrl, minify, minifyJs },
) => {
  const jsUrl = jsRessource.url
  const jsString = String(jsRessource.bufferBeforeBuild)
  const jsSourcemapUrl = getJavaScriptSourceMappingUrl(jsString)

  let sourcemapReference
  if (jsSourcemapUrl) {
    sourcemapReference = notifyReferenceFound({
      referenceLabel: "js sourcemapping comment",
      contentTypeExpected: ["application/json", "application/octet-stream"],
      ressourceSpecifier: jsSourcemapUrl,
      // we don't really know the line or column
      // but let's asusme it the last line and first column
      referenceLine: jsString.split(/\r?\n/).length,
      // ${"//#"} is to avoid a parser thinking there is a sourceMappingUrl for this file
      referenceColumn: `${"//#"} sourceMappingURL=`.length + 1,
      isSourcemap: true,
    })
  } else {
    sourcemapReference = notifyReferenceFound({
      referenceLabel: "js sourcemapping comment",
      contentType: "application/octet-stream",
      ressourceSpecifier: urlToRelativeUrl(generateSourcemapUrl(jsUrl), jsUrl),
      isPlaceholder: true,
      isSourcemap: true,
    })
  }

  return async ({ buildDirectoryUrl }) => {
    const sourcemapRessource = sourcemapReference.ressource
    let map
    let content
    if (!sourcemapRessource.isPlaceholder) {
      map = JSON.parse(String(sourcemapRessource.bufferBeforeBuild))
    }

    // in case this js asset is a worker, we transform it so that
    // importScripts() calls are inlined
    // We could also parse each importScripts call and decide to inline
    // or not. For now inlining/concatenation is forced
    if (jsRessource.isWorker || jsRessource.isServiceWorker) {
      const transformResult = await transformWorker({
        url: asOriginalUrl(jsUrl),
        map,
        content: String(jsRessource.bufferBeforeBuild),
      })
      map = transformResult.map
      content = transformResult.content
    } else {
      content = jsString
    }

    const jsCompiledUrl = jsRessource.url
    const jsOriginalUrl = asOriginalUrl(jsCompiledUrl)

    if (minify) {
      const result = await minifyJs({
        toplevel: false,
        url: map ? asProjectUrl(jsCompiledUrl) : jsOriginalUrl,
        map,
        content,
      })
      content = result.content
      map = result.map
    }
    jsRessource.buildEnd(content)
    if (!map) {
      return
    }
    // In theory code should never be modified once buildEnd() is called
    // because buildRelativeUrl might be versioned based on file content
    // There is an exception for sourcemap because we want to update sourcemap.file
    // to the cached filename of the js file.
    // To achieve that we set/update the sourceMapping url comment in compiled js file.
    // This is totally fine to do that because sourcemap and js file lives togethers
    // so this comment changes nothing regarding cache invalidation and is not important
    // to decide buildRelativeUrl for this js file.
    const jsBuildUrl = resolveUrl(
      jsRessource.buildRelativeUrl,
      buildDirectoryUrl,
    )
    const sourcemapPrecomputedBuildUrl = generateSourcemapUrl(jsBuildUrl)
    map.file = urlToFilename(jsBuildUrl)
    if (map.sources) {
      map.sources = map.sources.map((source) => {
        const sourceUrl = resolveUrl(source, jsUrl)
        const sourceOriginalUrl = asOriginalUrl(sourceUrl) || sourceUrl
        const sourceUrlRelativeToSourceMap = urlToRelativeUrl(
          sourceOriginalUrl,
          sourcemapPrecomputedBuildUrl,
        )
        return sourceUrlRelativeToSourceMap
      })
    }
    const mapAsText = JSON.stringify(map, null, "  ")
    sourcemapRessource.buildEnd(mapAsText)
    const sourcemapBuildUrl = resolveUrl(
      sourcemapRessource.buildRelativeUrl,
      buildDirectoryUrl,
    )
    const sourcemapUrlForJs = urlToRelativeUrl(sourcemapBuildUrl, jsBuildUrl)
    const jsWithSourcemapComment = setJavaScriptSourceMappingUrl(
      content,
      sourcemapUrlForJs,
    )
    jsRessource.bufferAfterBuild = jsWithSourcemapComment
  }
}
