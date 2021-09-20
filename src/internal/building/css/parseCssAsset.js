import { basename } from "path"
import { urlToFilename, urlToRelativeUrl, resolveUrl } from "@jsenv/filesystem"
import {
  getCssSourceMappingUrl,
  setCssSourceMappingUrl,
} from "@jsenv/core/src/internal/sourceMappingURLUtils.js"
import { getTargetAsBase64Url } from "../asset-builder.util.js"
import { parseCssUrls } from "./parseCssUrls.js"
import { replaceCssUrls } from "./replaceCssUrls.js"

export const parseCssAsset = async (
  cssTarget,
  { notifyReferenceFound },
  { urlToOriginalServerUrl, minify, minifyCssOptions },
) => {
  const cssString = String(cssTarget.bufferBeforeBuild)
  const cssSourcemapUrl = getCssSourceMappingUrl(cssString)
  let sourcemapReference
  if (cssSourcemapUrl) {
    sourcemapReference = notifyReferenceFound({
      referenceExpectedContentType: "application/json",
      referenceTargetSpecifier: cssSourcemapUrl,
      // we don't really know the line or column
      // but let's asusme it the last line and first column
      referenceLine: cssString.split(/\r?\n/).length - 1,
      referenceColumn: 0,
    })
  }

  const { atImports, urlDeclarations } = await parseCssUrls(
    cssString,
    cssTarget.targetUrl,
  )

  const urlNodeReferenceMapping = new Map()
  atImports.forEach((atImport) => {
    const importReference = notifyReferenceFound({
      referenceTargetSpecifier: atImport.specifier,
      ...cssNodeToReferenceLocation(atImport.urlDeclarationNode),
    })
    urlNodeReferenceMapping.set(atImport.urlNode, importReference)
  })
  urlDeclarations.forEach((urlDeclaration) => {
    const urlReference = notifyReferenceFound({
      referenceTargetSpecifier: urlDeclaration.specifier,
      ...cssNodeToReferenceLocation(urlDeclaration.urlDeclarationNode),
    })
    urlNodeReferenceMapping.set(urlDeclaration.urlNode, urlReference)
  })

  return async ({
    getReferenceUrlRelativeToImporter,
    precomputeBuildRelativeUrl,
    registerAssetEmitter,
  }) => {
    const cssReplaceResult = await replaceCssUrls(
      cssString,
      cssTarget.targetUrl,
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
        const { target } = urlNodeReference

        const { targetIsExternal } = target
        if (targetIsExternal) {
          return urlNode.value
        }

        const { targetIsInline } = target
        if (targetIsInline) {
          return getTargetAsBase64Url(target)
        }
        return getReferenceUrlRelativeToImporter(urlNodeReference)
      },
      {
        cssMinification: minify,
        cssMinificationOptions: minifyCssOptions,
        // https://postcss.org/api/#sourcemapoptions
        sourcemapOptions: sourcemapReference
          ? { prev: String(sourcemapReference.target.targetBuildBuffer) }
          : {},
      },
    )
    const code = cssReplaceResult.css
    const map = cssReplaceResult.map.toJSON()
    const cssBuildRelativeUrl = precomputeBuildRelativeUrl(code)

    const cssSourcemapFilename = `${basename(cssBuildRelativeUrl)}.map`

    // In theory code should never be modified once the url for caching is computed
    // because url for caching depends on file content.
    // There is an exception for sourcemap because we want to update sourcemap.file
    // to the cached filename of the css file.
    // To achieve that we set/update the sourceMapping url comment in compiled css file.
    // This is totally fine to do that because sourcemap and css file lives togethers
    // so this comment changes nothing regarding cache invalidation and is not important
    // to decide the filename for this css asset.
    const cssSourceAfterTransformation = setCssSourceMappingUrl(
      code,
      cssSourcemapFilename,
    )

    registerAssetEmitter(({ buildDirectoryUrl, emitAsset }) => {
      const cssBuildUrl = resolveUrl(
        cssTarget.targetBuildRelativeUrl,
        buildDirectoryUrl,
      )
      const mapBuildUrl = resolveUrl(cssSourcemapFilename, cssBuildUrl)
      map.file = urlToFilename(cssBuildUrl)
      if (map.sources) {
        // hum en fait si css est inline, alors la source n'est pas le fichier compilé
        // mais bien le fichier html compilé ?
        const importerUrl = cssTarget.targetIsInline
          ? urlToOriginalServerUrl(cssTarget.targetUrl)
          : cssTarget.targetUrl
        map.sources = map.sources.map((source) => {
          const sourceUrl = resolveUrl(source, importerUrl)
          const sourceUrlRelativeToSourceMap = urlToRelativeUrl(
            sourceUrl,
            mapBuildUrl,
          )
          return sourceUrlRelativeToSourceMap
        })
      }

      const mapSource = JSON.stringify(map, null, "  ")
      const buildRelativeUrl = urlToRelativeUrl(mapBuildUrl, buildDirectoryUrl)
      if (sourcemapReference) {
        sourcemapReference.target.targetBuildRelativeUrl = buildRelativeUrl
        sourcemapReference.target.targetBuildBuffer = mapSource
      } else {
        emitAsset({
          fileName: buildRelativeUrl,
          source: mapSource,
        })
      }
    })

    return {
      targetBuildRelativeUrl: cssBuildRelativeUrl,
      targetBuildBuffer: cssSourceAfterTransformation,
    }
  }
}

const cssNodeToReferenceLocation = (node) => {
  const { line, column } = node.source.start
  return {
    referenceLine: line,
    referenceColumn: column,
  }
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
