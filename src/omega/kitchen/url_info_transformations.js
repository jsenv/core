import { composeTwoSourcemaps } from "@jsenv/utils/sourcemap/sourcemap_composition_v3.js"
import {
  sourcemapComment,
  sourcemapToBase64Url,
  generateSourcemapUrl,
} from "@jsenv/utils/sourcemap/sourcemap_utils.js"

export const createUrlInfoTransformer = ({
  logger,
  sourcemaps,
  sourcemapsSources,
  urlGraph,
  foundSourcemap,
  injectSourcemapPlaceholder,
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
      urlInfo.isInline || sourcemapsSources
    if (sourcemap.sources && sourcemap.sources.length > 1) {
      sourcemap.sources = sourcemap.sources.map(
        (source) => new URL(source, urlInfo.data.sourceUrl || urlInfo.url).href,
      )
      if (!wantSourcesContent) {
        sourcemap.sourcesContent = undefined
      }
      return sourcemap
    }
    sourcemap.sources = [urlInfo.data.sourceUrl || urlInfo.url]
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
    if (urlInfo.sourcemap) {
      return
    }
    // create a placeholder reference for the sourcemap that will be generated
    // when jsenv is done cooking the file
    //   during build it's urlInfo.url to be inside the build
    //   but otherwise it's generatedUrl to be inside .jsenv/ directory
    urlInfo.sourcemapGeneratedUrl = generateSourcemapUrl(urlInfo.generatedUrl)
    injectSourcemapPlaceholder({
      urlInfo,
      specifier: urlInfo.sourcemapGeneratedUrl,
    })
    // check for existing sourcemap for this content
    const sourcemapFound = sourcemapComment.read({
      contentType: urlInfo.contentType,
      content: urlInfo.content,
    })
    if (sourcemapFound) {
      const { type, line, column, specifier } = sourcemapFound
      const [sourcemapReference, sourcemapUrlInfo] = foundSourcemap({
        urlInfo,
        type,
        line,
        column,
        specifier,
      })
      try {
        await context.cook({
          reference: sourcemapReference,
          urlInfo: sourcemapUrlInfo,
        })
        const sourcemap = JSON.parse(sourcemapUrlInfo.content)
        urlInfo.sourcemap = normalizeSourcemap(sourcemap, urlInfo)
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

      const sourcemapReference = urlInfo.references.find(
        (ref) => ref.type === "sourcemap_comment",
      )
      const sourcemapUrlInfo = urlGraph.getUrlInfo(sourcemapReference.url)
      sourcemapUrlInfo.contentType = "application/json"
      sourcemapUrlInfo.content = JSON.stringify(urlInfo.sourcemap, null, "  ")
      urlInfo.sourcemapUrl = sourcemapUrlInfo.url

      if (sourcemaps === "inline") {
        sourcemapReference.generatedSpecifier = sourcemapToBase64Url(
          urlInfo.sourcemap,
        )
      }
      if (sourcemaps === "file" || sourcemaps === "inline") {
        urlInfo.content = sourcemapComment.write({
          contentType: urlInfo.contentType,
          content: urlInfo.content,
          specifier: sourcemapReference.generatedSpecifier,
        })
      }
    }
  }

  return {
    initTransformations,
    applyIntermediateTransformations,
    applyFinalTransformations,
  }
}
