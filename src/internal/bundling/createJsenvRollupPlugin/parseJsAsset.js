import { basename } from "path"
import { urlToBasename, resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { setJavaScriptSourceMappingUrl } from "../../sourceMappingURLUtils.js"
import { minifyJs } from "./minifyJs.js"
import { fetchSourcemap } from "./fetchSourcemap.js"

export const parseJsAsset = async (
  { source, url, relativeUrl },
  notifiers,
  { minify, minifyJsOptions },
) => {
  const jsString = String(source)
  let map = await fetchSourcemap(url, jsString)

  return async ({ precomputeFileNameForRollup, registerAssetEmitter }) => {
    let jsSourceAfterTransformation = jsString

    if (minify) {
      const result = await minifyJs(jsString, relativeUrl, {
        sourceMap: {
          ...(map ? { content: JSON.stringify(map) } : {}),
          asObject: true,
        },
        toplevel: false,
        ...minifyJsOptions,
      })
      jsSourceAfterTransformation = result.code
      map = result.map
    }

    if (map) {
      const jsFileNameForRollup = precomputeFileNameForRollup(jsString)
      const jsSourcemapFilename = `${basename(jsFileNameForRollup)}.map`
      jsSourceAfterTransformation = setJavaScriptSourceMappingUrl(
        jsSourceAfterTransformation,
        jsSourcemapFilename,
      )

      registerAssetEmitter(({ importerProjectUrl, importerBundleUrl }) => {
        const mapBundleUrl = resolveUrl(jsSourcemapFilename, importerBundleUrl)
        map.file = urlToBasename(importerBundleUrl)
        map.sources = map.sources.map((source) => {
          const sourceUrl = resolveUrl(source, importerProjectUrl)
          const sourceUrlRelativeToSourceMap = urlToRelativeUrl(sourceUrl, mapBundleUrl)
          return sourceUrlRelativeToSourceMap
        })

        const assetSource = JSON.stringify(map, null, "  ")
        const assetUrl = mapBundleUrl
        return { assetSource, assetUrl }
      })

      return {
        sourceAfterTransformation: jsSourceAfterTransformation,
        fileNameForRollup: jsFileNameForRollup,
      }
    }

    return jsSourceAfterTransformation
  }
}
