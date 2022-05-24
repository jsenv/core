import { bufferToEtag, urlToRelativeUrl } from "@jsenv/filesystem"

import { composeTwoSourcemaps } from "@jsenv/utils/sourcemap/sourcemap_composition_v3.js"
import {
  SOURCEMAP,
  sourcemapToBase64Url,
  generateSourcemapUrl,
} from "@jsenv/utils/sourcemap/sourcemap_utils.js"

export const createUrlInfoTransformer = ({
  logger,
  sourcemaps,
  sourcemapsSourcesContent,
  sourcemapsRelativeSources,
  urlGraph,
  injectSourcemapPlaceholder,
  foundSourcemap,
}) => {
  const sourcemapsEnabled =
    sourcemaps === "inline" ||
    sourcemaps === "file" ||
    sourcemaps === "programmatic"

  const normalizeSourcemap = (urlInfo, sourcemap) => {
    const wantSourcesContent =
      // for inline content (<script> insdide html)
      // chrome won't be able to fetch the file as it does not exists
      // so sourcemap must contain sources
      sourcemapsSourcesContent ||
      urlInfo.isInline ||
      (sourcemap.sources &&
        sourcemap.sources.some(
          (source) => !source || !source.startsWith("file:"),
        ))
    if (sourcemap.sources && sourcemap.sources.length > 1) {
      sourcemap.sources = sourcemap.sources.map(
        (source) => new URL(source, urlInfo.data.rawUrl || urlInfo.url).href,
      )
      if (!wantSourcesContent) {
        sourcemap.sourcesContent = undefined
      }
      return sourcemap
    }
    sourcemap.sources = [urlInfo.data.rawUrl || urlInfo.url]
    sourcemap.sourcesContent = [urlInfo.originalContent]
    if (!wantSourcesContent) {
      sourcemap.sourcesContent = undefined
    }
    return sourcemap
  }

  const initTransformations = async (urlInfo, context) => {
    if (!sourcemapsEnabled) {
      return
    }
    if (!SOURCEMAP.enabledOnContentType(urlInfo.contentType)) {
      return
    }
    // sourcemap is a special kind of reference:
    // It's a reference to a content generated dynamically the content itself.
    // For this reason sourcemap are not added to urlInfo.references
    // Instead they are stored into urlInfo.sourcemapReference
    // create a placeholder reference for the sourcemap that will be generated
    // when jsenv is done cooking the file
    //   during build it's urlInfo.url to be inside the build
    //   but otherwise it's generatedUrl to be inside .jsenv/ directory
    urlInfo.sourcemapGeneratedUrl = generateSourcemapUrl(urlInfo.generatedUrl)
    const [sourcemapReference, sourcemapUrlInfo] = injectSourcemapPlaceholder({
      urlInfo,
      specifier: urlInfo.sourcemapGeneratedUrl,
    })
    urlInfo.sourcemapReference = sourcemapReference
    sourcemapUrlInfo.isInline = sourcemaps === "inline"

    // already loaded during "load" hook (happens during build)
    if (urlInfo.sourcemap) {
      return
    }
    // check for existing sourcemap for this content
    const sourcemapFound = SOURCEMAP.readComment({
      contentType: urlInfo.contentType,
      content: urlInfo.content,
    })
    if (sourcemapFound) {
      const { type, line, column, specifier } = sourcemapFound
      const [sourcemapReference, sourcemapUrlInfo] = foundSourcemap({
        urlInfo,
        type,
        specifier,
        specifierLine: line,
        specifierColumn: column,
      })
      try {
        await context.cook({
          reference: sourcemapReference,
          urlInfo: sourcemapUrlInfo,
        })
        const sourcemap = JSON.parse(sourcemapUrlInfo.content)
        urlInfo.sourcemap = normalizeSourcemap(urlInfo, sourcemap)
      } catch (e) {
        logger.error(`Error while handling existing sourcemap: ${e.message}`)
        return
      }
    }
  }

  const applyIntermediateTransformations = async (urlInfo, transformations) => {
    if (!transformations) {
      return
    }
    const { type, contentType, content, sourcemap } = transformations
    if (type) {
      urlInfo.type = type
    }
    if (contentType) {
      urlInfo.contentType = contentType
    }
    if (content) {
      urlInfo.content = content
    }
    if (sourcemapsEnabled && sourcemap) {
      const sourcemapNormalized = normalizeSourcemap(urlInfo, sourcemap)
      const finalSourcemap = await composeTwoSourcemaps(
        urlInfo.sourcemap,
        sourcemapNormalized,
      )
      const finalSourcemapNormalized = normalizeSourcemap(
        urlInfo,
        finalSourcemap,
      )
      urlInfo.sourcemap = finalSourcemapNormalized
    }
  }

  const applyFinalTransformations = async (urlInfo, transformations) => {
    if (transformations) {
      await applyIntermediateTransformations(urlInfo, transformations)
    }
    if (sourcemapsEnabled && urlInfo.sourcemap) {
      // during build this function can be called after the file is cooked
      // - to update content and sourcemap after "optimize" hook
      // - to inject versioning into the entry point content
      // in this scenarion we don't want to call injectSourcemap
      // just update the content and the
      const sourcemapReference = urlInfo.sourcemapReference
      const sourcemapUrlInfo = urlGraph.getUrlInfo(sourcemapReference.url)
      sourcemapUrlInfo.contentType = "application/json"
      const sourcemap = urlInfo.sourcemap
      if (sourcemapsRelativeSources) {
        sourcemap.sources = sourcemap.sources.map((source) => {
          const sourceRelative = urlToRelativeUrl(source, urlInfo.url)
          return sourceRelative
        })
      }
      sourcemapUrlInfo.content = JSON.stringify(sourcemap, null, "  ")
      if (sourcemaps === "inline") {
        sourcemapReference.generatedSpecifier = sourcemapToBase64Url(sourcemap)
      }
      if (sourcemaps === "file" || sourcemaps === "inline") {
        urlInfo.content = SOURCEMAP.writeComment({
          contentType: urlInfo.contentType,
          content: urlInfo.content,
          specifier:
            sourcemaps === "file" && sourcemapsRelativeSources
              ? urlToRelativeUrl(sourcemapReference.url, urlInfo.url)
              : sourcemapReference.generatedSpecifier,
        })
      }
    }
    urlInfo.contentEtag = bufferToEtag(Buffer.from(urlInfo.content))
  }

  return {
    initTransformations,
    applyIntermediateTransformations,
    applyFinalTransformations,
  }
}
