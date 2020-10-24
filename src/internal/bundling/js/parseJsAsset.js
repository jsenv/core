import { basename } from "path"
import { urlToFilename, resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import {
  getJavaScriptSourceMappingUrl,
  setJavaScriptSourceMappingUrl,
} from "@jsenv/core/src/internal/sourceMappingURLUtils.js"
import { minifyJs } from "./minifyJs.js"

export const parseJsAsset = async (
  jsTarget,
  { notifyReferenceFound },
  { minify, minifyJsOptions },
) => {
  const jsUrl = jsTarget.url
  const jsString = String(jsTarget.content.value)
  const jsSourcemapUrl = getJavaScriptSourceMappingUrl(jsString)
  let sourcemapReference

  if (jsSourcemapUrl) {
    sourcemapReference = notifyReferenceFound({
      specifier: jsSourcemapUrl,
      contentType: "application/json",
      // we don't really know the line or column
      // but let's asusme it the last line and first column
      line: jsString.split(/\r?\n/).length - 1,
      column: 0,
    })
  }

  return async ({ precomputeBundleRelativeUrl, registerAssetEmitter }) => {
    let map
    if (sourcemapReference) {
      map = JSON.parse(sourcemapReference.target.sourceAfterTransformation)
    }

    let jsSourceAfterTransformation = jsString

    if (minify) {
      const jsUrlRelativeToImporter = jsTarget.isInline
        ? urlToRelativeUrl(jsTarget.url, jsTarget.importers[0].url)
        : jsTarget.relativeUrl
      const result = await minifyJs(jsString, jsUrlRelativeToImporter, {
        sourceMap: {
          ...(map ? { content: JSON.stringify(map) } : {}),
          asObject: true,
        },
        toplevel: false,
        ...minifyJsOptions,
      })
      jsSourceAfterTransformation = result.code
      map = result.map
      if (!map.sourcesContent) {
        map.sourcesContent = [jsString]
      }
    }

    if (map) {
      const jsBundleRelativeUrl = precomputeBundleRelativeUrl(jsString)
      const jsSourcemapFilename = `${basename(jsBundleRelativeUrl)}.map`
      jsSourceAfterTransformation = setJavaScriptSourceMappingUrl(
        jsSourceAfterTransformation,
        jsSourcemapFilename,
      )

      registerAssetEmitter(({ bundleDirectoryUrl, emitAsset }) => {
        const jsBundleUrl = resolveUrl(jsTarget.bundleRelativeUrl, bundleDirectoryUrl)
        const mapBundleUrl = resolveUrl(jsSourcemapFilename, jsBundleUrl)
        map.file = urlToFilename(jsBundleUrl)
        if (map.sources) {
          map.sources = map.sources.map((source) => {
            const sourceUrl = resolveUrl(source, jsUrl)
            const sourceUrlRelativeToSourceMap = urlToRelativeUrl(sourceUrl, mapBundleUrl)
            return sourceUrlRelativeToSourceMap
          })
        }

        const mapSource = JSON.stringify(map, null, "  ")
        const bundleRelativeUrl = urlToRelativeUrl(mapBundleUrl, bundleDirectoryUrl)
        emitAsset({
          source: mapSource,
          fileName: bundleRelativeUrl,
        })
        if (sourcemapReference) {
          // redirect original sourcemap from bundle to a new file
          // we'll need to remove the old asset from rollup bundle
          // and emit a new one instead
          // when finding this asset in the rollupbundle we'll have to remove it
          sourcemapReference.target.updateOnceReady({ bundleRelativeUrl })
        }
      })

      return {
        sourceAfterTransformation: jsSourceAfterTransformation,
        bundleRelativeUrl: jsBundleRelativeUrl,
      }
    }

    return jsSourceAfterTransformation
  }
}
