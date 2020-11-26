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
    precomputeBundleRelativeUrl,
    registerAssetEmitter,
  }) => {
    const cssReplaceResult = await replaceCssUrls(
      cssString,
      cssUrl,
      ({ urlNode }) => {
        const nodeCandidates = Array.from(urlNodeReferenceMapping.keys())
        const urlNodeFound = nodeCandidates.find((urlNodeCandidate) =>
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
    const cssBundleRelativeUrl = precomputeBundleRelativeUrl(code)

    const cssSourcemapFilename = `${basename(cssBundleRelativeUrl)}.map`

    // In theory code should never be modified once the url for caching is computed
    // because url for caching depends on file content.
    // There is an exception for sourcemap because we want to update sourcemap.file
    // to the cached filename of the css file.
    // To achieve that we set/update the sourceMapping url comment in compiled css file.
    // This is totally fine to do that because sourcemap and css file lives togethers
    // so this comment changes nothing regarding cache invalidation and is not important
    // to decide the filename for this css asset.
    const cssSourceAfterTransformation = setCssSourceMappingUrl(code, cssSourcemapFilename)

    registerAssetEmitter(({ buildDirectoryUrl, emitAsset }) => {
      const cssBundleUrl = resolveUrl(cssTarget.bundleRelativeUrl, buildDirectoryUrl)
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
      const bundleRelativeUrl = urlToRelativeUrl(mapBundleUrl, buildDirectoryUrl)

      if (sourcemapReference) {
        sourcemapReference.target.updateOnceReady({
          sourceAfterTransformation: mapSource,
          bundleRelativeUrl,
        })
      } else {
        emitAsset({
          source: mapSource,
          fileName: bundleRelativeUrl,
        })
      }
    })

    return {
      sourceAfterTransformation: cssSourceAfterTransformation,
      bundleRelativeUrl: cssBundleRelativeUrl,
    }
  }
}

const cssNodeToSourceLocation = (node) => {
  const { line, column } = node.source.start
  return { line, column }
}

const isSameCssDocumentUrlNode = (firstUrlNode, secondUrlNode) => {
  if (!compareUrlNodeTypes(firstUrlNode.type, secondUrlNode.type)) {
    return false
  }
  if (!compareUrlNodeValue(firstUrlNode.value, secondUrlNode.value)) {
    return false
  }
  // maybe this sourceIndex should be removed in case there is some css transformation one day?
  // it does not seems to change though as if it was refering the original file source index
  if (firstUrlNode.sourceIndex !== secondUrlNode.sourceIndex) {
    return false
  }
  return true
}

// minification may change url node type from string to word
// that's still the same node
const compareUrlNodeTypes = (firstUrlNodeType, secondUrlNodeType) => {
  if (firstUrlNodeType === secondUrlNodeType) {
    return true
  }
  if (firstUrlNodeType === "word" && secondUrlNodeType === "string") {
    return true
  }
  if (firstUrlNodeType === "string" && secondUrlNodeType === "word") {
    return true
  }
  return false
}

// minification may change url node value from './whatever.png' to 'whatever.png'
// the value still revolves to the same target
const compareUrlNodeValue = (firstUrlNodeValue, secondUrlNodeValue) => {
  const firstValueNormalized = urlToRelativeUrl(
    resolveUrl(firstUrlNodeValue, "file:///"),
    "file:///",
  )
  const secondValueNormalized = urlToRelativeUrl(
    resolveUrl(secondUrlNodeValue, "file:///"),
    "file:///",
  )
  return firstValueNormalized === secondValueNormalized
}
