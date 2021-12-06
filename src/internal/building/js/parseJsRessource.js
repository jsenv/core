import { urlToFilename, resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import {
  getJavaScriptSourceMappingUrl,
  setJavaScriptSourceMappingUrl,
} from "@jsenv/core/src/internal/sourceMappingURLUtils.js"
import { transformWorker } from "./transform_worker.js"

export const parseJsRessource = async (
  jsRessource,
  { notifyReferenceFound },
  { asProjectUrl, asOriginalUrl, minify, minifyJs },
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
      ressourceSpecifier: `${urlToFilename(jsUrl)}.map`,
      isPlaceholder: true,
      isSourcemap: true,
    })
  }

  return async ({ buildDirectoryUrl }) => {
    const sourcemapRessource = sourcemapReference.ressource

    let code
    let map
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
        code: String(jsRessource.bufferBeforeBuild),
        map,
      })
      code = transformResult.code
      map = transformResult.map
    } else {
      code = jsString
    }

    const jsCompiledUrl = jsRessource.url
    const jsOriginalUrl = asOriginalUrl(jsCompiledUrl)

    if (minify) {
      const result = await minifyJs({
        url: map ? asProjectUrl(jsCompiledUrl) : jsOriginalUrl,
        code,
        map,
        toplevel: false,
      })
      code = result.code
      map = result.map
    }

    jsRessource.buildEnd(code)

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
    const sourcemapPrecomputedBuildUrl = resolveUrl(
      `${urlToFilename(jsBuildUrl)}.map`,
      jsBuildUrl,
    )

    map.file = urlToFilename(jsBuildUrl)
    if (map.sources) {
      map.sources = map.sources.map((source) => {
        const sourceUrl = resolveUrl(source, jsOriginalUrl)
        const sourceUrlRelativeToSourceMap = urlToRelativeUrl(
          sourceUrl,
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
    const codeWithSourcemapComment = setJavaScriptSourceMappingUrl(
      code,
      sourcemapUrlForJs,
    )
    jsRessource.bufferAfterBuild = codeWithSourcemapComment
  }
}
