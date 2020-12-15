import { basename } from "path"
import { urlToFilename, resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import {
  getJavaScriptSourceMappingUrl,
  setJavaScriptSourceMappingUrl,
} from "@jsenv/core/src/internal/sourceMappingURLUtils.js"
import { bundleWorker } from "@jsenv/core/src/internal/building/bundleWorker.js"
import { minifyJs } from "./minifyJs.js"

export const parseJsAsset = async (
  jsTarget,
  { notifyReferenceFound },
  { urlToOriginalProjectUrl, minify, minifyJsOptions },
) => {
  const jsUrl = jsTarget.targetUrl
  const jsString = String(jsTarget.targetBuffer)
  const jsSourcemapUrl = getJavaScriptSourceMappingUrl(jsString)
  let sourcemapReference

  if (jsSourcemapUrl) {
    sourcemapReference = notifyReferenceFound({
      referenceExpectedContentType: "application/json",
      referenceTargetSpecifier: jsSourcemapUrl,
      // we don't really know the line or column
      // but let's asusme it the last line and first column
      referenceLine: jsString.split(/\r?\n/).length - 1,
      referenceColumn: 0,
    })
  }

  return async ({ precomputeBuildRelativeUrl, registerAssetEmitter }) => {
    let map
    if (sourcemapReference) {
      map = JSON.parse(sourcemapReference.target.targetBufferAfterTransformation)
    }

    // in case this js asset is a worker, bundle it so that:
    // importScripts are inlined which is good for:
    // - not breaking things (otherwise we would have to copy imported files in the build directory)
    // - perf (one less http request)
    const mightBeAWorkerScript = !jsTarget.targetIsInline

    let jsSourceAfterTransformation
    if (mightBeAWorkerScript) {
      const workerScriptUrl = urlToOriginalProjectUrl(jsUrl)
      const workerBundle = await bundleWorker({ workerScriptUrl, workerScriptSourceMap: map })
      jsSourceAfterTransformation = workerBundle.code
      map = workerBundle.map
    } else {
      jsSourceAfterTransformation = jsString
    }

    if (minify) {
      const jsUrlRelativeToImporter = jsTarget.targetIsInline
        ? urlToRelativeUrl(jsTarget.targetUrl, jsTarget.targetReferences[0].referenceUrl)
        : jsTarget.targetRelativeUrl
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
        const jsBuildUrl = resolveUrl(jsTarget.targetBuildRelativeUrl, buildDirectoryUrl)
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
            targetBufferAfterTransformation: mapSource,
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
        targetBufferAfterTransformation: jsSourceAfterTransformation,
        targetBuildRelativeUrl: jsBuildRelativeUrl,
      }
    }

    return jsSourceAfterTransformation
  }
}
