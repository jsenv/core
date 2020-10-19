import { basename } from "path"
import { urlToFilename, urlToRelativeUrl, resolveUrl } from "@jsenv/util"
import {
  getCssSourceMappingUrl,
  setCssSourceMappingUrl,
} from "@jsenv/core/src/internal/sourceMappingURLUtils.js"
import { parseCssUrls } from "./parseCssUrls.js"
import { replaceCssUrls } from "./replaceCssUrls.js"
import { getTargetAsBase64Url } from "../getTargetAsBase64Url.js"

export const parseCssAsset = async (
  cssTarget,
  { notifyReferenceFound },
  { minify, minifyCssOptions },
) => {
  const cssUrl = cssTarget.url
  const cssString = String(cssTarget.content.value)
  const cssSourcemapUrl = getCssSourceMappingUrl(cssString)
  let sourcemapReference
  if (cssSourcemapUrl) {
    sourcemapReference = notifyReferenceFound({
      specifier: cssSourcemapUrl,
      contentType: "application/json",
      // we don't really know the line or column
      // but let's asusme it the last line and first column
      line: cssString.split(/\r?\n/).length - 1,
      column: 0,
    })
  }

  const { atImports, urlDeclarations } = await parseCssUrls(cssString, cssUrl)

  const urlNodeReferenceMapping = new Map()
  atImports.forEach((atImport) => {
    const importReference = notifyReferenceFound({
      specifier: atImport.specifier,
      ...cssNodeToSourceLocation(atImport.urlDeclarationNode),
    })
    urlNodeReferenceMapping.set(atImport.urlNode, importReference)
  })
  urlDeclarations.forEach((urlDeclaration) => {
    const urlReference = notifyReferenceFound({
      specifier: urlDeclaration.specifier,
      ...cssNodeToSourceLocation(urlDeclaration.urlDeclarationNode),
    })
    urlNodeReferenceMapping.set(urlDeclaration.urlNode, urlReference)
  })

  return async ({
    getReferenceUrlRelativeToImporter,
    precomputeFileNameForRollup,
    registerAssetEmitter,
  }) => {
    const cssReplaceResult = await replaceCssUrls(
      cssString,
      cssUrl,
      ({ urlNode }) => {
        const urlNodeFound = Array.from(urlNodeReferenceMapping.keys()).find((urlNodeCandidate) =>
          isSameCssDocumentUrlNode(urlNodeCandidate, urlNode),
        )
        if (!urlNodeFound) {
          return urlNode.value
        }

        // url node nous dit quel réfrence y correspond
        const urlNodeReference = urlNodeReferenceMapping.get(urlNodeFound)
        const { isInline } = urlNodeReference.target
        if (isInline) {
          return getTargetAsBase64Url(urlNodeReference.target)
        }
        return getReferenceUrlRelativeToImporter(urlNodeReference)
      },
      {
        cssMinification: minify,
        cssMinificationOptions: minifyCssOptions,
        sourcemapOptions: sourcemapReference
          ? { prev: sourcemapReference.target.sourceAfterTransformation }
          : {},
      },
    )
    const code = cssReplaceResult.css
    const map = cssReplaceResult.map.toJSON()
    const cssFileNameForRollup = precomputeFileNameForRollup(code)

    const cssSourcemapFilename = `${basename(cssFileNameForRollup)}.map`

    // In theory code should never be modified once the url for caching is computed
    // because url for caching depends on file content.
    // There is an exception for sourcemap because we want to update sourcemap.file
    // to the cached filename of the css file.
    // To achieve that we set/update the sourceMapping url comment in compiled css file.
    // This is totally fine to do that because sourcemap and css file lives togethers
    // so this comment changes nothing regarding cache invalidation and is not important
    // to decide the filename for this css asset.
    const cssSourceAfterTransformation = setCssSourceMappingUrl(code, cssSourcemapFilename)

    registerAssetEmitter(({ bundleDirectoryUrl, emitAsset }) => {
      const cssBundleUrl = resolveUrl(cssTarget.fileNameForRollup, bundleDirectoryUrl)
      const mapBundleUrl = resolveUrl(cssSourcemapFilename, cssBundleUrl)
      map.file = urlToFilename(cssBundleUrl)
      if (map.sources) {
        map.sources = map.sources.map((source) => {
          const sourceUrl = resolveUrl(source, cssTarget.url)
          const sourceUrlRelativeToSourceMap = urlToRelativeUrl(sourceUrl, mapBundleUrl)
          return sourceUrlRelativeToSourceMap
        })
      }

      const mapSource = JSON.stringify(map, null, "  ")
      const relativeUrl = urlToRelativeUrl(mapBundleUrl, bundleDirectoryUrl)
      const fileNameForRollup = relativeUrl
      emitAsset({
        source: mapSource,
        fileName: fileNameForRollup,
      })
      if (sourcemapReference) {
        sourcemapReference.target.updateFileNameForRollup(fileNameForRollup)
      }
    })

    return {
      sourceAfterTransformation: cssSourceAfterTransformation,
      fileNameForRollup: cssFileNameForRollup,
    }
  }
}

const cssNodeToSourceLocation = (node) => {
  const { line, column } = node.source.start
  return { line, column }
}

const isSameCssDocumentUrlNode = (firstUrlNode, secondUrlNode) => {
  if (firstUrlNode.type !== secondUrlNode.type) {
    return false
  }
  if (firstUrlNode.value !== secondUrlNode.value) {
    return false
  }
  if (firstUrlNode.sourceIndex !== secondUrlNode.sourceIndex) {
    return false
  }
  return true
}
