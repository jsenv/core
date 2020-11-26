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

  return async ({ precomputeBuildRelativeUrl, registerAssetEmitter }) => {
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
      const jsBuildRelativeUrl = precomputeBuildRelativeUrl(jsString)
      const jsSourcemapFilename = `${basename(jsBuildRelativeUrl)}.map`
      jsSourceAfterTransformation = setJavaScriptSourceMappingUrl(
        jsSourceAfterTransformation,
        jsSourcemapFilename,
      )

      registerAssetEmitter(({ buildDirectoryUrl, emitAsset }) => {
        const jsBuildUrl = resolveUrl(jsTarget.buildRelativeUrl, buildDirectoryUrl)
        const mapBuildUrl = resolveUrl(jsSourcemapFilename, jsBuildUrl)
        map.file = urlToFilename(jsBuildUrl)
        if (map.sources) {
          map.sources = map.sources.map((source) => {
            const sourceUrl = resolveUrl(source, jsUrl)
            const sourceUrlRelativeToSourceMap = urlToRelativeUrl(sourceUrl, mapBuildUrl)
            return sourceUrlRelativeToSourceMap
          })
        }

        const mapSource = JSON.stringify(map, null, "  ")
        const buildRelativeUrl = urlToRelativeUrl(mapBuildUrl, buildDirectoryUrl)

        if (sourcemapReference) {
          // redirect original sourcemap from build to a new file
          // we'll need to remove the old asset from rollup build
          // and emit a new one instead
          // when finding this asset in the rollup build we'll have to remove it
          sourcemapReference.target.updateOnceReady({
            sourceAfterTransformation: mapSource,
            buildRelativeUrl,
          })
        } else {
          emitAsset({
            source: mapSource,
            fileName: buildRelativeUrl,
          })
        }
      })

      return {
        sourceAfterTransformation: jsSourceAfterTransformation,
        buildRelativeUrl: jsBuildRelativeUrl,
      }
    }

    return jsSourceAfterTransformation
  }
}
