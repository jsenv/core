import { basename } from "path"
import { urlToRelativeUrl, resolveUrl } from "@jsenv/util"
import { setCssSourceMappingUrl } from "../../sourceMappingURLUtils.js"
import { parseCssUrls } from "./css/parseCssUrls.js"
import { replaceCssUrls } from "./css/replaceCssUrls.js"

export const parseCssAsset = async (
  { url, source },
  { notifyAssetFound },
  { minify, minifyCssOptions },
) => {
  const cssString = String(source)
  const { atImports, urlDeclarations } = await parseCssUrls(cssString, url)

  const urlNodeReferenceMapping = new Map()
  atImports.forEach((atImport) => {
    const cssImportReference = notifyAssetFound({
      specifier: atImport.specifier,
      ...cssNodeToSourceLocation(atImport.urlDeclarationNode),
    })
    urlNodeReferenceMapping.set(atImport.urlNode, cssImportReference)
  })
  urlDeclarations.forEach((urlDeclaration) => {
    const cssAssetReference = notifyAssetFound({
      specifier: urlDeclaration.specifier,
      ...cssNodeToSourceLocation(urlDeclaration.urlDeclarationNode),
    })
    urlNodeReferenceMapping.set(urlDeclaration.urlNode, cssAssetReference)
  })

  return async (dependenciesMapping, { precomputeFileNameForRollup, registerAssetEmitter }) => {
    const cssReplaceResult = await replaceCssUrls(
      cssString,
      url,
      ({ urlNode }) => {
        const urlNodeFound = Array.from(urlNodeReferenceMapping.keys()).find((urlNodeCandidate) =>
          isSameCssDocumentUrlNode(urlNodeCandidate, urlNode),
        )
        if (!urlNodeFound) {
          return urlNode.value
        }
        // url node nous dit quel réfrence y correspond
        const urlNodeReference = urlNodeReferenceMapping.get(urlNodeFound)
        return dependenciesMapping[urlNodeReference.target.url]
      },
      {
        cssMinification: minify,
        cssMinificationOptions: minifyCssOptions,
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

    registerAssetEmitter(({ importerProjectUrl, importerBundleUrl }) => {
      const mapBundleUrl = resolveUrl(cssSourcemapFilename, importerBundleUrl)
      map.file = basename(importerBundleUrl)
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
