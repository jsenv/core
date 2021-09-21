import { basename } from "path"
import { urlToFilename, urlToRelativeUrl, resolveUrl } from "@jsenv/filesystem"
import {
  getCssSourceMappingUrl,
  setCssSourceMappingUrl,
} from "@jsenv/core/src/internal/sourceMappingURLUtils.js"
import { getRessourceAsBase64Url } from "../ressource_builder_util.js"
import { parseCssUrls } from "./parseCssUrls.js"
import { replaceCssUrls } from "./replaceCssUrls.js"

export const parseCssRessource = async (
  cssRessource,
  { notifyReferenceFound },
  { urlToOriginalServerUrl, minify, minifyCssOptions },
) => {
  const cssString = String(cssRessource.bufferBeforeBuild)
  const cssSourcemapUrl = getCssSourceMappingUrl(cssString)
  let sourcemapReference
  if (cssSourcemapUrl) {
    sourcemapReference = notifyReferenceFound({
      ressourceContentTypeExpected: "application/json",
      ressourceSpecifier: cssSourcemapUrl,
      // we don't really know the line or column
      // but let's asusme it the last line and first column
      referenceLine: cssString.split(/\r?\n/).length - 1,
      referenceColumn: 0,
    })
  }

  const { atImports, urlDeclarations } = await parseCssUrls(
    cssString,
    cssRessource.ressourceUrl,
  )

  const urlNodeReferenceMapping = new Map()
  atImports.forEach((atImport) => {
    const importReference = notifyReferenceFound({
      ressourceSpecifier: atImport.specifier,
      ...cssNodeToReferenceLocation(atImport.urlDeclarationNode),
    })
    urlNodeReferenceMapping.set(atImport.urlNode, importReference)
  })
  urlDeclarations.forEach((urlDeclaration) => {
    const urlReference = notifyReferenceFound({
      ressourceSpecifier: urlDeclaration.specifier,
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
      cssRessource.ressourceUrl,
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
        const cssUrlRessource = urlNodeReference.ressource

        const { isExternal } = cssUrlRessource
        if (isExternal) {
          return urlNode.value
        }

        const { isInline } = cssUrlRessource
        if (isInline) {
          return getRessourceAsBase64Url(cssUrlRessource)
        }
        return getReferenceUrlRelativeToImporter(urlNodeReference)
      },
      {
        cssMinification: minify,
        cssMinificationOptions: minifyCssOptions,
        // https://postcss.org/api/#sourcemapoptions
        sourcemapOptions: sourcemapReference
          ? { prev: String(sourcemapReference.ressource.bufferAfterBuild) }
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
        cssRessource.ressourceBuildRelativeUrl,
        buildDirectoryUrl,
      )
      const mapBuildUrl = resolveUrl(cssSourcemapFilename, cssBuildUrl)
      map.file = urlToFilename(cssBuildUrl)
      if (map.sources) {
        // hum en fait si css est inline, alors la source n'est pas le fichier compilé
        // mais bien le fichier html compilé ?
        const importerUrl = cssRessource.isInline
          ? urlToOriginalServerUrl(cssRessource.ressourceUrl)
          : cssRessource.ressourceUrl
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
        sourcemapReference.ressource.ressourceBuildRelativeUrl =
          buildRelativeUrl
        sourcemapReference.ressource.bufferAfterBuild = mapSource
      } else {
        emitAsset({
          fileName: buildRelativeUrl,
          source: mapSource,
        })
      }
    })

    return {
      ressourceBuildRelativeUrl: cssBuildRelativeUrl,
      bufferAfterBuild: cssSourceAfterTransformation,
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
// the value still revolves to the same ressource
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
