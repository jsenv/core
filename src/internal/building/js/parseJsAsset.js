import { basename } from "path"
import { urlToFilename, resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"
import {
  getJavaScriptSourceMappingUrl,
  setJavaScriptSourceMappingUrl,
} from "@jsenv/core/src/internal/sourceMappingURLUtils.js"
import { bundleWorker } from "@jsenv/core/src/internal/building/bundleWorker.js"
import { minifyJs } from "./minifyJs.js"

export const parseJsAsset = async (
  jsTarget,
  { notifyReferenceFound },
  { urlToOriginalFileUrl, urlToOriginalServerUrl, minify, minifyJsOptions },
) => {
  const jsUrl = jsTarget.targetUrl
  const jsString = String(jsTarget.bufferBeforeBuild)
  const jsSourcemapUrl = getJavaScriptSourceMappingUrl(jsString)
  let sourcemapReference

  if (jsSourcemapUrl) {
    sourcemapReference = notifyReferenceFound({
      ressourceContentTypeExpected: "application/json",
      ressourceSpecifier: jsSourcemapUrl,
      // we don't really know the line or column
      // but let's asusme it the last line and first column
      referenceLine: jsString.split(/\r?\n/).length,
      referenceColumn: `//# sourceMappingURL=`.length + 1,
    })
  }

  return async ({ precomputeBuildRelativeUrl, registerAssetEmitter }) => {
    let map
    if (sourcemapReference) {
      const sourcemapString = String(
        sourcemapReference.ressource.bufferAfterBuild,
      )
      map = JSON.parse(sourcemapString)
    }

    // in case this js asset is a worker, bundle it so that:
    // importScripts are inlined which is good for:
    // - not breaking things (otherwise we would have to copy imported files in the build directory)
    // - perf (one less http request)
    const mightBeAWorkerScript = !jsTarget.isInline

    let jsSourceAfterTransformation
    if (mightBeAWorkerScript) {
      const workerScriptUrl = urlToOriginalFileUrl(jsUrl)
      const workerBundle = await bundleWorker({
        workerScriptUrl,
        workerScriptSourceMap: map,
      })
      jsSourceAfterTransformation = workerBundle.code
      map = workerBundle.map
    } else {
      jsSourceAfterTransformation = jsString
    }

    if (minify) {
      const jsUrlRelativeToImporter = jsTarget.isInline
        ? urlToRelativeUrl(
            jsTarget.targetUrl,
            jsTarget.references[0].referenceUrl,
          )
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
        const jsBuildUrl = resolveUrl(
          jsTarget.targetBuildRelativeUrl,
          buildDirectoryUrl,
        )
        const mapBuildUrl = resolveUrl(jsSourcemapFilename, jsBuildUrl)
        map.file = urlToFilename(jsBuildUrl)
        if (map.sources) {
          const importerUrl = jsTarget.isInline
            ? urlToOriginalServerUrl(jsTarget.targetUrl)
            : jsTarget.targetUrl

          map.sources = map.sources.map((source) => {
            const sourceUrl = resolveUrl(source, importerUrl)
            const sourceUrlRelativeToSourceMap = urlToRelativeUrl(
              urlToOriginalServerUrl(sourceUrl),
              mapBuildUrl,
            )
            return sourceUrlRelativeToSourceMap
          })
        }

        const mapSource = JSON.stringify(map, null, "  ")
        const buildRelativeUrl = urlToRelativeUrl(
          mapBuildUrl,
          buildDirectoryUrl,
        )

        if (sourcemapReference) {
          sourcemapReference.ressource.targetBuildRelativeUrl = buildRelativeUrl
          sourcemapReference.ressource.bufferAfterBuild = mapSource
        } else {
          emitAsset({
            fileName: buildRelativeUrl,
            source: mapSource,
          })
        }
      })

      return {
        targetBuildRelativeUrl: jsBuildRelativeUrl,
        bufferAfterBuild: jsSourceAfterTransformation,
      }
    }

    return jsSourceAfterTransformation
  }
}
